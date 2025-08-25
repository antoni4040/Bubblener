import { GoogleGenAI, Type } from '@google/genai';
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import EntitiesSchema from "@/utils/types/EntitiesSchema";

const createPrompt = (maxElements: number, withJson: boolean): string => {
    const prompt = `# ROLE:
    You are an expert research analyst. Your task is to extract key entities from a text and enrich them with your general knowledge to create a comprehensive knowledge base entry.

    # GOAL:
    Identify the most significant entities in the provided text (e.g., articles, book chapters, news reports). For each entity, you will provide a one-sentence description, a more detailed summary based *only* on the text, and then supplement it with external, factual context.

    # INSTRUCTIONS:
    1.  **Entity Identification**: Extract up to ${maxElements} of the most important entities. Focus on entities that are thematically significant or central to the text's narrative or argument.
    2.  **Canonical Naming**: Consolidate all mentions of an entity (e.g., "The Company", "Acme Corp.", "Acme") under their single, most complete and formal name (e.g., "Acme Corporation").
    3.  **Strict Information Synthesis**:
        * **Description**: The description field must be a *single, concise sentence* that defines the entity's primary identity or role as presented in the text.
        * **Summary**: The summary_from_text field must be a *3-4 sentence paragraph* that synthesizes all mentions of the entity to explain its broader activities, relationships, and significance *within the context of the document*.
        * **Enrichment**: The contextual_enrichment field should contain supplementary facts from your general knowledge. If the entity is fictional or you have no external knowledge, this value must be null.
    4.  **Entity Categorization**: Classify each entity into one of the following types: **Person**, **Organization**, **Location**, or **Key Concept/Theme** (e.g., "Quantum Entanglement", "Neoclassical Economics", "Character Arc").`

    if (withJson) {
        return `${prompt}
        # OUTPUT FORMAT:
        {
            "entities": [
                {
                    "entity_name": "string",
                    "entity_type": "string",
                    "description": "string",
                    "summary_from_text": "string",
                    "contextual_enrichment": "string"
                }
            ]
        }
        `;
    }

    return prompt;
}

export const GeminiAPIRequest = async (text: string, maxElements: number, apiKey: string): Promise<string> => {
    const genAI = new GoogleGenAI({ apiKey });
    const response = await genAI.models.generateContent({
        model: "gemini-2.5-flash-lite",
        contents: text,
        config: {
            thinkingConfig: {
                thinkingBudget: 0, // Disables thinking
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
                        description: {
                            type: Type.STRING,
                        },
                        summary_from_text: {
                            type: Type.STRING,
                        },
                        contextual_enrichment: {
                            type: Type.STRING,
                        },
                    },
                    propertyOrdering: ["entity_name", "entity_type",
                        "description", "summary_from_text", "contextual_enrichment"],
                },
            },
        }
    });

    return response.text ?? "";
}

export const ChatGPTAPIRequest = async (text: string, maxElements: number, apiKey: string): Promise<string> => {
    const openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });

    const response = await openai.responses.parse({
        model: "gpt-5-nano",
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
    });

    return response.output_text ?? "";
};

export const DeepSeekAPIRequest = async (text: string, maxElements: number, apiKey: string): Promise<string> => {
    const openai = new OpenAI({
        baseURL: 'https://api.deepseek.com',
        apiKey: apiKey,
        dangerouslyAllowBrowser: true
    });

    const response = await openai.chat.completions.create({
        messages: [{ role: "system", content: createPrompt(maxElements, true) },
        { role: "user", content: text }],
        model: "deepseek-chat",
    });

    return response.choices[0]?.message.content ?? "";
};