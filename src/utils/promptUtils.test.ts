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

import { GeminiAPIRequest, ChatGPTAPIRequest, DeepSeekAPIRequest } from '@/utils/promptUtils';

beforeEach(() => {
    generateContentMock.mockReset();
    responsesParseMock.mockReset();
    chatCompletionsCreateMock.mockReset();
    openaiConstructorSpy.mockReset();
});

describe('GeminiAPIRequest', () => {
    it('sends the page text as content and a maxElements-aware system instruction', async () => {
        generateContentMock.mockResolvedValue({ text: '[]' });

        const result = await GeminiAPIRequest('page text', 5, 'gemini-key');

        expect(generateContentMock).toHaveBeenCalledTimes(1);
        const call = generateContentMock.mock.calls[0][0];
        expect(call.contents).toBe('page text');
        expect(call.config.systemInstruction).toContain('up to 5');
        expect(call.config.responseSchema.type).toBe('ARRAY');
        expect(result).toBe('[]');
    });

    it('returns an empty string when the API responds with no text', async () => {
        generateContentMock.mockResolvedValue({});
        expect(await GeminiAPIRequest('text', 5, 'key')).toBe('');
    });
});

describe('ChatGPTAPIRequest', () => {
    it('sends system + user messages and returns output_text', async () => {
        responsesParseMock.mockResolvedValue({ output_text: '{"entities":[]}' });

        const result = await ChatGPTAPIRequest('page text', 8, 'gpt-key');

        expect(openaiConstructorSpy).toHaveBeenCalledWith({ apiKey: 'gpt-key', dangerouslyAllowBrowser: true });
        const call = responsesParseMock.mock.calls[0][0];
        expect(call.model).toBe('gpt-5-nano');
        expect(call.input[0]).toMatchObject({ role: 'system' });
        expect(call.input[0].content).toContain('up to 8');
        expect(call.input[1]).toMatchObject({ role: 'user', content: 'page text' });
        expect(result).toBe('{"entities":[]}');
    });

    it("does not embed a manual OUTPUT FORMAT block (schema is enforced separately)", async () => {
        responsesParseMock.mockResolvedValue({ output_text: '{}' });
        await ChatGPTAPIRequest('text', 5, 'key');
        const systemPrompt = responsesParseMock.mock.calls[0][0].input[0].content;
        expect(systemPrompt).not.toContain('OUTPUT FORMAT');
    });
});

describe('DeepSeekAPIRequest', () => {
    it('targets the DeepSeek base URL and returns the completion content', async () => {
        chatCompletionsCreateMock.mockResolvedValue({
            choices: [{ message: { content: '{"entities":[]}' } }],
        });

        const result = await DeepSeekAPIRequest('page text', 3, 'ds-key');

        expect(openaiConstructorSpy).toHaveBeenCalledWith(
            expect.objectContaining({ baseURL: 'https://api.deepseek.com', apiKey: 'ds-key' })
        );
        const call = chatCompletionsCreateMock.mock.calls[0][0];
        expect(call.model).toBe('deepseek-chat');
        expect(call.messages[1]).toMatchObject({ role: 'user', content: 'page text' });
        expect(result).toBe('{"entities":[]}');
    });

    it('embeds an explicit OUTPUT FORMAT block, unlike the schema-enforced providers', async () => {
        chatCompletionsCreateMock.mockResolvedValue({ choices: [{ message: { content: '{}' } }] });
        await DeepSeekAPIRequest('text', 5, 'key');
        const systemPrompt = chatCompletionsCreateMock.mock.calls[0][0].messages[0].content;
        expect(systemPrompt).toContain('OUTPUT FORMAT');
    });

    it('returns an empty string when no choices are returned', async () => {
        chatCompletionsCreateMock.mockResolvedValue({ choices: [] });
        expect(await DeepSeekAPIRequest('text', 5, 'key')).toBe('');
    });
});
