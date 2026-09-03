import { describe, expect, it, vi, beforeEach } from 'vitest';

const generateContentMock = vi.fn();
const responsesParseMock = vi.fn();
const chatCompletionsCreateMock = vi.fn();
const openaiConstructorSpy = vi.fn();

vi.mock('@google/genai', () => ({
    GoogleGenAI: vi.fn().mockImplementation(function GoogleGenAI() {
        return { models: { generateContent: generateContentMock } };
    }),
    Type: { ARRAY: 'ARRAY', OBJECT: 'OBJECT', STRING: 'STRING' },
    ThinkingLevel: { MINIMAL: 'MINIMAL', LOW: 'LOW', MEDIUM: 'MEDIUM', HIGH: 'HIGH' },
}));

vi.mock('openai', () => ({
    default: vi.fn().mockImplementation(function OpenAI(config: unknown) {
        openaiConstructorSpy(config);
        return {
            responses: { parse: responsesParseMock },
            chat: { completions: { create: chatCompletionsCreateMock } },
        };
    }),
}));

vi.mock('openai/helpers/zod', () => ({
    zodTextFormat: vi.fn().mockReturnValue({ type: 'json_schema' }),
}));

import { GeminiAPIRequest, ChatGPTAPIRequest, DeepSeekAPIRequest, OllamaAPIRequest } from '@/utils/promptUtils';

beforeEach(() => {
    generateContentMock.mockReset();
    responsesParseMock.mockReset();
    chatCompletionsCreateMock.mockReset();
    openaiConstructorSpy.mockReset();
});

describe('GeminiAPIRequest', () => {
    it('sends the page text as content and a maxElements-aware system instruction', async () => {
        generateContentMock.mockResolvedValue({ text: '[]', usageMetadata: { promptTokenCount: 120, candidatesTokenCount: 45 } });

        const result = await GeminiAPIRequest('page text', 5, 'gemini-key', 'gemini-3.5-flash-lite');

        expect(generateContentMock).toHaveBeenCalledTimes(1);
        const call = generateContentMock.mock.calls[0][0];
        expect(call.contents).toBe('page text');
        expect(call.config.systemInstruction).toContain('at most 5');
        // The grounding rules are the point of the prompt — assert they survive.
        expect(call.config.systemInstruction).toMatch(/verbatim/i);
        expect(call.config.systemInstruction).toMatch(/never add entities from your own knowledge/i);
        // Fiction must not gate enrichment: testing on a novel made every
        // entity fictional, so this rule emptied the field every single time.
        expect(call.config.systemInstruction).toMatch(/fictional is NOT a reason/i);
        expect(call.config.systemInstruction).not.toMatch(/if the entity is fictional[^.]*must be null/i);
        expect(call.config.responseSchema.type).toBe('ARRAY');
        // Gemini enforces the schema: a non-nullable string leaves the model no
        // way to express "no enrichment" except the literal word "null".
        expect(call.config.responseSchema.items.properties.contextual_enrichment)
            .toMatchObject({ nullable: true });
        // `thinkingBudget` is a 400 on Gemini 3.x — it must be `thinkingLevel`.
        expect(call.config.thinkingConfig).toEqual({ thinkingLevel: 'LOW' });
        expect(call.config.thinkingConfig).not.toHaveProperty('thinkingBudget');
        expect(result.text).toBe('[]');
        expect(result.usage).toEqual({ input: 120, output: 45 });
    });

    it('returns an empty string when the API responds with no text', async () => {
        generateContentMock.mockResolvedValue({});
        expect((await GeminiAPIRequest('text', 5, 'key', 'gemini-3.5-flash-lite')).text).toBe('');
    });
});

describe('ChatGPTAPIRequest', () => {
    it('sends system + user messages and returns output_text', async () => {
        responsesParseMock.mockResolvedValue({ output_text: '{"entities":[]}', usage: { input_tokens: 300, output_tokens: 80 } });

        const result = await ChatGPTAPIRequest('page text', 8, 'gpt-key', 'gpt-5.6-luna');

        // A bounded timeout and retry budget: a struggling provider must not
        // hold the page open indefinitely.
        expect(openaiConstructorSpy).toHaveBeenCalledWith(
            expect.objectContaining({ apiKey: 'gpt-key', dangerouslyAllowBrowser: true })
        );
        const client = openaiConstructorSpy.mock.calls[0][0];
        expect(client.timeout).toBeGreaterThan(0);
        expect(client.maxRetries).toBeLessThanOrEqual(1);
        const call = responsesParseMock.mock.calls[0][0];
        expect(call.model).toBe('gpt-5.6-luna');
        expect(call.input[0]).toMatchObject({ role: 'system' });
        expect(call.input[0].content).toContain('at most 8');
        expect(call.input[1]).toMatchObject({ role: 'user', content: 'page text' });
        expect(result.text).toBe('{"entities":[]}');
        expect(result.usage).toEqual({ input: 300, output: 80 });
    });

    it("does not embed a manual OUTPUT FORMAT block (schema is enforced separately)", async () => {
        responsesParseMock.mockResolvedValue({ output_text: '{}' });
        await ChatGPTAPIRequest('text', 5, 'key', 'gpt-5.6-luna');
        const systemPrompt = responsesParseMock.mock.calls[0][0].input[0].content;
        expect(systemPrompt).not.toContain('OUTPUT FORMAT');
    });
});

describe('DeepSeekAPIRequest', () => {
    it('targets the DeepSeek base URL and returns the completion content', async () => {
        chatCompletionsCreateMock.mockResolvedValue({
            choices: [{ message: { content: '{"entities":[]}' } }],
            usage: { prompt_tokens: 210, completion_tokens: 60 },
        });

        const result = await DeepSeekAPIRequest('page text', 3, 'ds-key', 'deepseek-v4-flash');

        expect(openaiConstructorSpy).toHaveBeenCalledWith(
            expect.objectContaining({ baseURL: 'https://api.deepseek.com', apiKey: 'ds-key' })
        );
        const call = chatCompletionsCreateMock.mock.calls[0][0];
        expect(call.model).toBe('deepseek-v4-flash');
        expect(call.messages[1]).toMatchObject({ role: 'user', content: 'page text' });
        // DeepSeek has no schema enforcement, so JSON mode and an output cap
        // large enough to avoid truncation are what keep responses parseable.
        expect(call.response_format).toEqual({ type: 'json_object' });
        expect(call.max_tokens).toBeGreaterThanOrEqual(8192);
        expect(result.text).toBe('{"entities":[]}');
        expect(result.usage).toEqual({ input: 210, output: 60 });
    });

    it('embeds an explicit OUTPUT FORMAT block, unlike the schema-enforced providers', async () => {
        chatCompletionsCreateMock.mockResolvedValue({ choices: [{ message: { content: '{}' } }] });
        await DeepSeekAPIRequest('text', 5, 'key', 'deepseek-v4-flash');
        const systemPrompt = chatCompletionsCreateMock.mock.calls[0][0].messages[0].content;
        expect(systemPrompt).toContain('OUTPUT FORMAT');
        // DeepSeek's JSON mode requires the literal word "json" in the prompt.
        expect(systemPrompt).toContain('json');
    });

    it('returns an empty string when no choices are returned', async () => {
        chatCompletionsCreateMock.mockResolvedValue({ choices: [] });
        expect((await DeepSeekAPIRequest('text', 5, 'key', 'deepseek-v4-flash')).text).toBe('');
    });
});

describe('OllamaAPIRequest', () => {
    it('talks to the local OpenAI-compatible router and needs no real key', async () => {
        chatCompletionsCreateMock.mockResolvedValue({
            choices: [{ message: { content: '{"entities":[]}' } }],
            usage: { prompt_tokens: 90, completion_tokens: 20 },
        });

        const result = await OllamaAPIRequest('page text', 4, '', 'llama3.2');

        expect(openaiConstructorSpy).toHaveBeenCalledWith(
            expect.objectContaining({ baseURL: 'http://localhost:11434/v1' })
        );
        // The SDK demands a key; Ollama ignores it. It must never be empty,
        // or the SDK throws before the request is made.
        expect(openaiConstructorSpy.mock.calls[0][0].apiKey).toBeTruthy();

        const call = chatCompletionsCreateMock.mock.calls[0][0];
        expect(call.model).toBe('llama3.2');
        expect(call.response_format).toEqual({ type: 'json_object' });
        expect(call.temperature).toBe(0);
        expect(result.usage).toEqual({ input: 90, output: 20 });
    });
});
