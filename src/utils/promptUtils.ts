import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import EntitiesSchema from "@/utils/types/EntitiesSchema";
import TokenUsage from "@/utils/types/TokenUsage";

export interface ProviderResponse {
    text: string;
    usage: TokenUsage;
}

export interface ProviderRequest {
    text: string;
    maxElements: number;
    apiKey: string;
    model: string;
    /**
     * Called with the whole response accumulated so far, each time more of it
     * arrives. Providers stream raw text and stay ignorant of entities; the
     * caller decides what a partial buffer is worth.
     */
    onPartial?: (accumulated: string) => void;
    /**
     * Cancels the request when the reader has moved on. Scrolling fires a new
     * analysis while the previous one is still in flight; without this the
     * abandoned request runs to completion, spends tokens, and delivers
     * entities for a section already left behind.
     */
    signal?: AbortSignal;
}

const NO_USAGE: TokenUsage = { input: 0, output: 0 };

/** Without this a hung request leaves the page spinning indefinitely. */
export const REQUEST_TIMEOUT_MS = 90_000;

/** The OpenAI SDK retries 5xx/429 twice by default, so a struggling provider
 *  could hold the page for three full timeouts. One retry is enough to ride
 *  out a blip without turning a bad minute into a bad five. */
export const MAX_RETRIES = 1;

const createPrompt = (maxElements: number, withJson: boolean): string => {
    const prompt = `# ROLE:
    You are an expert research analyst building a reading index for a passage of text.

    # GOAL:
    Identify the most significant entities that actually appear in the provided
    text. For each one, give a one-sentence description, a short summary drawn
    only from the text, and optionally some outside context.

    # GROUNDING RULES (these take priority over everything else):
    1.  **Only what is in the text.** Every entity must genuinely appear in the
        passage you were given. Never add entities from your own knowledge of
        the work, its author, its title, or what you expect a text like this to
        contain. If the passage is a fragment, index only that fragment.
        This rule governs *which* entities you list and what goes in
        description and summary_from_text. It does not restrict
        contextual_enrichment, whose whole purpose is outside knowledge.
    2.  **Use the words on the page.** entity_name must be a string that occurs
        verbatim in the text. When several forms appear, choose the fullest one
        that is literally present — do not assemble a more formal name that
        does not occur (write "Acme" if that is all the text says, never
        "Acme Corporation").
    3.  **List the surface forms.** mentions must contain the distinct strings
        that literally occur in the text for this entity, including
        entity_name. Proper names and specific noun phrases only.
        Never include a pronoun of any kind — not he, she, it, they, him, her,
        and not reflexives like himself, herself, themselves. Never include a
        bare common noun (the man, the company). These words point at whoever
        the sentence happens to be about, so highlighting them marks passages
        that are about somebody else entirely.
    4.  **Fewer is fine.** Extract at most ${maxElements} entities, ranked by
        significance to this passage. If the passage supports fewer, return
        fewer. Never pad the list to reach the limit.
    5.  **Score the significance.** importance is a number from 0.0 to 1.0
        saying how central this entity is to *this* passage — not how famous it
        is in general. A protagonist driving the scene is near 1.0; someone
        named once in passing is near 0.1. Spread the scores out; do not give
        everything 0.8.

    # FIELDS:
    * **importance**: a number in [0.0, 1.0], as described in rule 5.
    * **description**: a single concise sentence defining the entity's role as
      presented in the text.
    * **summary_from_text**: a 3-4 sentence paragraph supported by the provided
      text alone. Do not import facts the passage does not state.
    * **contextual_enrichment**: background this passage does not supply,
      drawn from your own knowledge — what this entity is in the wider world,
      or in the wider work it belongs to.
      Being fictional is NOT a reason to leave this empty. Well-documented
      characters, places and works (Raskolnikov, Middle-earth, the Pequod)
      should be enriched exactly like real ones. Emit the JSON value null —
      bare null, never the text "null", "N/A" or an empty string — only when
      you genuinely lack reliable knowledge of this specific entity: something
      this document invented, an obscure local name, or anything you would be
      guessing at. Never fill it by restating the passage.
    * **entity_type**: exactly one of these four strings, and never any other:
      **Person**, **Organization**, **Location**, **Key Concept/Theme**.
      There is no category for physical objects, events or works — a
      significant axe, letter or ikon belongs under **Key Concept/Theme**.
      Never invent a category such as "Object" or "Event": an unrecognised
      value makes the entity unusable.`

    if (withJson) {
        return `${prompt}
        # OUTPUT FORMAT:
        Respond with a single json object, and nothing else — no prose, no code
        fences, no trailing commas. It must match this shape exactly:
        {
            "entities": [
                {
                    "entity_name": "string",
                    "entity_type": "string",
                    "mentions": ["string"],
                    "importance": 0.0,
                    "description": "string",
                    "summary_from_text": "string",
                    "contextual_enrichment": "string, or the literal null"
                }
            ]
        }
        `;
    }

    return prompt;
}

export const GeminiAPIRequest = async ({ text, maxElements, apiKey, model, onPartial, signal }: ProviderRequest): Promise<ProviderResponse> => {
    const genAI = new GoogleGenAI({ apiKey });
    const stream = await genAI.models.generateContentStream({
        model,
        contents: text,
        config: {
            // Whichever comes first: the timeout, or the reader scrolling on.
            abortSignal: signal
                ? AbortSignal.any([signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)])
                : AbortSignal.timeout(REQUEST_TIMEOUT_MS),
            thinkingConfig: {
                // Gemini 3.x replaced `thinkingBudget` with `thinkingLevel`,
                // and no longer allows thinking to be switched off entirely —
                // sending the old field is a 400 INVALID_ARGUMENT. LOW is the
                // cheapest level both 3.5-flash-lite and 3.8-flash accept, and
                // entity extraction needs no deep reasoning.
                thinkingLevel: ThinkingLevel.LOW,
            },
            systemInstruction: createPrompt(maxElements, false),
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        entity_name: {
                            type: Type.STRING,
                        },
                        entity_type: {
                            type: Type.STRING,
                            enum: ['Person', 'Organization', 'Location', 'Key Concept/Theme'],
                        },
                        mentions: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING },
                        },
                        importance: {
                            type: Type.NUMBER,
                        },
                        description: {
                            type: Type.STRING,
                        },
                        summary_from_text: {
                            type: Type.STRING,
                        },
                        contextual_enrichment: {
                            type: Type.STRING,
                            // Without this the schema admits no empty value and
                            // the model returns the *string* "null" instead.
                            nullable: true,
                        },
                    },
                    propertyOrdering: ["entity_name", "entity_type", "mentions",
                        "importance", "description", "summary_from_text",
                        "contextual_enrichment"],
                },
            },
        }
    });

    let accumulated = '';
    let usage = NO_USAGE;
    for await (const chunk of stream) {
        // Usage-only chunks carry no text; re-scanning for entities then is
        // pure waste.
        const piece = chunk.text ?? '';
        if (piece) {
            accumulated += piece;
            onPartial?.(accumulated);
        }
        // Usage arrives on the final chunk, so keep the latest seen.
        if (chunk.usageMetadata) {
            usage = {
                input: chunk.usageMetadata.promptTokenCount ?? 0,
                output: chunk.usageMetadata.candidatesTokenCount ?? 0,
            };
        }
    }

    return { text: accumulated, usage };
}

export const ChatGPTAPIRequest = async ({ text, maxElements, apiKey, model, onPartial, signal }: ProviderRequest): Promise<ProviderResponse> => {
    const openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true, timeout: REQUEST_TIMEOUT_MS, maxRetries: MAX_RETRIES });

    const stream = await openai.responses.create({
        stream: true,
        model,
        input: [
            {
                role: "system",
                content: createPrompt(maxElements, false),
            },
            {
                role: "user",
                content: text,
            },
        ],
        text: {
            format: zodTextFormat(EntitiesSchema, "entities"),
        },
        reasoning: {
            effort: "minimal"
        }
    }, { signal });

    let accumulated = '';
    let usage = NO_USAGE;
    for await (const event of stream) {
        if (event.type === 'response.output_text.delta') {
            accumulated += event.delta;
            onPartial?.(accumulated);
        } else if (event.type === 'response.completed') {
            usage = {
                input: event.response.usage?.input_tokens ?? 0,
                output: event.response.usage?.output_tokens ?? 0,
            };
        }
    }

    return { text: accumulated, usage };
};


/**
 * Shared streaming loop for the OpenAI-compatible providers.
 *
 * `include_usage` is opt-in: DeepSeek documents it, Ollama does not list it,
 * and an unknown parameter can be rejected outright. Omitting it costs nothing
 * — if a server volunteers usage on the final chunk, the loop still takes it.
 */
const streamChatCompletion = async (
    openai: OpenAI,
    body: Record<string, unknown>,
    onPartial: ((accumulated: string) => void) | undefined,
    includeUsage: boolean,
    signal?: AbortSignal,
): Promise<ProviderResponse> => {
    const stream = await openai.chat.completions.create({
        ...body,
        stream: true,
        ...(includeUsage ? { stream_options: { include_usage: true } } : {}),
    } as any, { signal });

    let accumulated = '';
    let usage = NO_USAGE;
    for await (const chunk of stream as any) {
        const piece = chunk.choices?.[0]?.delta?.content ?? '';
        if (piece) {
            accumulated += piece;
            onPartial?.(accumulated);
        }
        if (chunk.usage) {
            usage = {
                input: chunk.usage.prompt_tokens ?? 0,
                output: chunk.usage.completion_tokens ?? 0,
            };
        }
    }

    return { text: accumulated, usage };
};

/** DeepSeek's non-standard switch for turning thinking mode off. */
const NO_THINKING = { thinking: { type: 'disabled' } } as {};

export const DeepSeekAPIRequest = async ({ text, maxElements, apiKey, model, onPartial, signal }: ProviderRequest): Promise<ProviderResponse> => {
    const openai = new OpenAI({
        baseURL: 'https://api.deepseek.com',
        apiKey: apiKey,
        dangerouslyAllowBrowser: true,
        timeout: REQUEST_TIMEOUT_MS,
        maxRetries: MAX_RETRIES
    });

    return streamChatCompletion(openai, {
        messages: [{ role: "system", content: createPrompt(maxElements, true) },
        { role: "user", content: text }],
        model,
        // DeepSeek is the one provider without schema-enforced output, so ask
        // for JSON mode explicitly rather than trusting the prompt alone.
        response_format: { type: 'json_object' },
        // The default output cap truncates mid-object once maxElements grows,
        // and a truncated object is invalid JSON.
        max_tokens: 8192,
        // DeepSeek v4 thinks by default and bills the thinking as completion
        // tokens: measured at 3,510 output tokens for three entities on a
        // two-sentence passage, and ~29s per call. Extraction needs no
        // deliberation. Spread rather than declared, since `thinking` is a
        // DeepSeek extension the OpenAI types do not carry.
        ...NO_THINKING,
    }, onPartial, true, signal);
};
/**
 * Ollama, through its OpenAI-compatible router at /v1.
 *
 * The API key is required by the SDK but ignored by Ollama, and nothing leaves
 * the machine — which is the whole point of this provider.
 */
export const OllamaAPIRequest = async ({ text, maxElements, model, onPartial, signal }: ProviderRequest): Promise<ProviderResponse> => {
    const openai = new OpenAI({
        baseURL: 'http://localhost:11434/v1',
        apiKey: 'ollama',
        dangerouslyAllowBrowser: true,
        timeout: REQUEST_TIMEOUT_MS,
        maxRetries: MAX_RETRIES
    });

    return streamChatCompletion(openai, {
        messages: [{ role: "system", content: createPrompt(maxElements, true) },
        { role: "user", content: text }],
        model,
        response_format: { type: 'json_object' },
        max_tokens: 8192,
        // Small local models drift into invalid JSON at higher temperatures.
        temperature: 0,
    }, onPartial, false, signal);
};
