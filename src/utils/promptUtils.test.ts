import { describe, expect, it, vi, beforeEach } from 'vitest';

const generateContentStreamMock = vi.fn();
const responsesCreateMock = vi.fn();
const chatCompletionsCreateMock = vi.fn();
const openaiConstructorSpy = vi.fn();

/** Turns fixture chunks into the async iterable each SDK hands back. */
async function* asStream<T>(chunks: T[]) {
    for (const chunk of chunks) yield chunk;
}

vi.mock('@google/genai', () => ({
    GoogleGenAI: vi.fn().mockImplementation(function GoogleGenAI() {
        return { models: { generateContentStream: generateContentStreamMock } };
    }),
    Type: { ARRAY: 'ARRAY', OBJECT: 'OBJECT', STRING: 'STRING' },
    ThinkingLevel: { MINIMAL: 'MINIMAL', LOW: 'LOW', MEDIUM: 'MEDIUM', HIGH: 'HIGH' },
}));

vi.mock('openai', () => ({
    default: vi.fn().mockImplementation(function OpenAI(config: unknown) {
        openaiConstructorSpy(config);
        return {
            responses: { create: responsesCreateMock },
            chat: { completions: { create: chatCompletionsCreateMock } },
        };
    }),
}));

vi.mock('openai/helpers/zod', () => ({
    zodTextFormat: vi.fn().mockReturnValue({ type: 'json_schema' }),
}));

import {
    GeminiAPIRequest, ChatGPTAPIRequest, DeepSeekAPIRequest, OllamaAPIRequest,
} from '@/utils/promptUtils';

beforeEach(() => {
    generateContentStreamMock.mockReset();
    responsesCreateMock.mockReset();
    chatCompletionsCreateMock.mockReset();
    openaiConstructorSpy.mockReset();
});

const base = { text: 'page text', maxElements: 5, apiKey: 'key', model: 'a-model' };

describe('GeminiAPIRequest', () => {
    it('streams the answer, reporting each partial and the final usage', async () => {
        generateContentStreamMock.mockResolvedValue(asStream([
            { text: '[{"entity' },
            { text: '_name": "Acme"}]' },
            { usageMetadata: { promptTokenCount: 120, candidatesTokenCount: 45 } },
        ]));

        const partials: string[] = [];
        const result = await GeminiAPIRequest({
            ...base,
            onPartial: (accumulated) => partials.push(accumulated),
        });

        // Each callback sees everything received so far, not just the delta.
        expect(partials).toEqual(['[{"entity', '[{"entity_name": "Acme"}]']);
        expect(result.text).toBe('[{"entity_name": "Acme"}]');
        expect(result.usage).toEqual({ input: 120, output: 45 });
    });

    it('sends the page text, the maxElements limit and the grounding rules', async () => {
        generateContentStreamMock.mockResolvedValue(asStream([{ text: '[]' }]));

        await GeminiAPIRequest({ ...base, maxElements: 5 });

        const call = generateContentStreamMock.mock.calls[0][0];
        expect(call.contents).toBe('page text');
        expect(call.config.systemInstruction).toContain('at most 5');
        expect(call.config.systemInstruction).toMatch(/verbatim/i);
        expect(call.config.systemInstruction).toMatch(/never add entities from your own knowledge/i);
        // Fiction must not gate enrichment: on a novel that emptied every field.
        expect(call.config.systemInstruction).toMatch(/fictional is NOT a reason/i);
        expect(call.config.systemInstruction).not.toMatch(/if the entity is fictional[^.]*must be null/i);
        // `thinkingBudget` is a 400 on Gemini 3.x — it must be `thinkingLevel`.
        expect(call.config.thinkingConfig).toEqual({ thinkingLevel: 'LOW' });
        // A non-nullable string leaves no way to say "no enrichment" but "null".
        expect(call.config.responseSchema.items.properties.contextual_enrichment)
            .toMatchObject({ nullable: true });
    });

    it('survives a stream that never reports usage', async () => {
        generateContentStreamMock.mockResolvedValue(asStream([{ text: '[]' }]));
        expect((await GeminiAPIRequest(base)).usage).toEqual({ input: 0, output: 0 });
    });
});

describe('ChatGPTAPIRequest', () => {
    it('accumulates output_text deltas and takes usage from the completed event', async () => {
        responsesCreateMock.mockResolvedValue(asStream([
            { type: 'response.output_text.delta', delta: '{"entities":' },
            { type: 'response.output_text.delta', delta: '[]}' },
            { type: 'response.completed', response: { usage: { input_tokens: 300, output_tokens: 80 } } },
        ]));

        const partials: string[] = [];
        const result = await ChatGPTAPIRequest({
            ...base, maxElements: 8, apiKey: 'gpt-key', model: 'gpt-5.6-luna',
            onPartial: (a) => partials.push(a),
        });

        const call = responsesCreateMock.mock.calls[0][0];
        expect(call.stream).toBe(true);
        expect(call.model).toBe('gpt-5.6-luna');
        expect(call.input[0].content).toContain('at most 8');
        expect(partials.at(-1)).toBe('{"entities":[]}');
        expect(result.text).toBe('{"entities":[]}');
        expect(result.usage).toEqual({ input: 300, output: 80 });
    });

    it('ignores unrelated stream events', async () => {
        responsesCreateMock.mockResolvedValue(asStream([
            { type: 'response.created' },
            { type: 'response.reasoning_text.delta', delta: 'thinking...' },
            { type: 'response.output_text.delta', delta: '[]' },
        ]));

        expect((await ChatGPTAPIRequest(base)).text).toBe('[]');
    });

    it('bounds the timeout and retry budget', async () => {
        responsesCreateMock.mockResolvedValue(asStream([]));
        await ChatGPTAPIRequest({ ...base, apiKey: 'gpt-key' });

        const client = openaiConstructorSpy.mock.calls[0][0];
        expect(client.apiKey).toBe('gpt-key');
        expect(client.timeout).toBeGreaterThan(0);
        expect(client.maxRetries).toBeLessThanOrEqual(1);
    });
});

describe('DeepSeekAPIRequest', () => {
    it('streams chat completion deltas and asks for usage explicitly', async () => {
        chatCompletionsCreateMock.mockResolvedValue(asStream([
            { choices: [{ delta: { content: '{"entities"' } }] },
            { choices: [{ delta: { content: ':[]}' } }] },
            { choices: [], usage: { prompt_tokens: 210, completion_tokens: 60 } },
        ]));

        const result = await DeepSeekAPIRequest({
            ...base, maxElements: 3, apiKey: 'ds-key', model: 'deepseek-v4-flash',
        });

        expect(openaiConstructorSpy).toHaveBeenCalledWith(
            expect.objectContaining({ baseURL: 'https://api.deepseek.com', apiKey: 'ds-key' })
        );
        const call = chatCompletionsCreateMock.mock.calls[0][0];
        expect(call.model).toBe('deepseek-v4-flash');
        expect(call.stream).toBe(true);
        // Streaming suppresses usage unless it is requested.
        expect(call.stream_options).toEqual({ include_usage: true });
        // No schema enforcement here, so JSON mode and a generous output cap
        // are what keep responses parseable.
        expect(call.response_format).toEqual({ type: 'json_object' });
        expect(call.max_tokens).toBeGreaterThanOrEqual(8192);
        expect(result.text).toBe('{"entities":[]}');
        expect(result.usage).toEqual({ input: 210, output: 60 });
    });

    it('spells out the JSON contract, including the word "json" its API requires', async () => {
        chatCompletionsCreateMock.mockResolvedValue(asStream([]));
        await DeepSeekAPIRequest(base);

        const prompt = chatCompletionsCreateMock.mock.calls[0][0].messages[0].content;
        expect(prompt).toContain('OUTPUT FORMAT');
        expect(prompt).toContain('json');
    });

    it('returns empty text when the stream yields nothing', async () => {
        chatCompletionsCreateMock.mockResolvedValue(asStream([]));
        expect((await DeepSeekAPIRequest(base)).text).toBe('');
    });
});

describe('OllamaAPIRequest', () => {
    it('talks to the local router, needs no real key, and pins temperature to 0', async () => {
        chatCompletionsCreateMock.mockResolvedValue(asStream([
            { choices: [{ delta: { content: '[]' } }] },
        ]));

        const result = await OllamaAPIRequest({ ...base, apiKey: '', model: 'llama3.2' });

        expect(openaiConstructorSpy).toHaveBeenCalledWith(
            expect.objectContaining({ baseURL: 'http://localhost:11434/v1' })
        );
        // The SDK demands a key; Ollama ignores it. Empty would throw locally.
        expect(openaiConstructorSpy.mock.calls[0][0].apiKey).toBeTruthy();

        const call = chatCompletionsCreateMock.mock.calls[0][0];
        expect(call.model).toBe('llama3.2');
        expect(call.stream).toBe(true);
        expect(call.temperature).toBe(0);
        // Ollama does not document stream_options; an unknown param can 400.
        expect(call.stream_options).toBeUndefined();
        expect(result.text).toBe('[]');
    });
});
