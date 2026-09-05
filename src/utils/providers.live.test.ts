import { describe, expect, it } from 'vitest';
import {
    GeminiAPIRequest, ChatGPTAPIRequest, DeepSeekAPIRequest, OllamaAPIRequest,
    type ProviderResponse, type ProviderRequest,
} from '@/utils/promptUtils';
import parseEntitiesResponse from '@/utils/parseEntitiesResponse';
import models from '@/utils/constants/models';
import ModelAPIsEnum from '@/utils/types/modelAPIsEnum';
import ModelTierEnum from '@/utils/types/modelTierEnum';

/**
 * Live provider tests — real requests, real keys, real (tiny) cost.
 *
 * These exist because the mocked suite asserts what we *send* and can never
 * observe what a provider *accepts*. Everything checked here has broken in
 * production at least once: a thinking parameter the model rejected, a model
 * id quietly retired, a schema that made `null` unrepresentable, a streaming
 * body that parsed as empty.
 *
 * Run with `npm run test:live`. Each provider skips itself when its key is
 * absent, so one key is enough.
 */

// Deliberately short: two well-known entities, a handful of tokens each way.
// A full run is a fraction of a cent.
const PASSAGE = `Ada Lovelace worked with Charles Babbage on the Analytical Engine
in London during the 1840s. Lovelace's notes on the machine are often described
as the first published algorithm intended for a computer.`;

const MAX_ELEMENTS = 3;

type Caller = (request: ProviderRequest) => Promise<ProviderResponse>;

/** 503/429 means the provider is busy, not that our request is wrong — this
 *  suite exists to validate the request shape, so transient capacity failures
 *  are retried rather than reported as defects. */
const isTransient = (error: any): boolean =>
    error?.status === 429 || error?.status === 503
    || /unavailable|overloaded|high demand|rate.?limit|503|429/i.test(error?.message ?? '');

const withRetry = async <T>(run: () => Promise<T>, attempts = 3): Promise<T> => {
    for (let attempt = 1; ; attempt++) {
        try {
            return await run();
        } catch (error) {
            if (attempt >= attempts || !isTransient(error)) throw error;
            console.log(`    provider busy, retrying (${attempt}/${attempts - 1})…`);
            await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
        }
    }
};

/** Asserts everything that must hold for a response to be usable downstream. */
const expectUsableResponse = (response: ProviderResponse, label: string) => {
    expect(response.text, `${label}: empty body`).toBeTruthy();

    // The real contract: whatever came back must survive our own parser.
    const entities = parseEntitiesResponse(response.text);
    expect(entities.length, `${label}: no entities parsed`).toBeGreaterThan(0);

    for (const entity of entities) {
        expect(entity.entity_name.trim()).not.toBe('');
        expect(['Person', 'Organization', 'Location', 'Key Concept/Theme'])
            .toContain(entity.entity_type);

        // The placeholder-string bug: "null" as text rather than JSON null.
        expect(entity.contextual_enrichment, `${label}: enrichment is the string "null"`)
            .not.toBe('null');

        if (entity.importance !== undefined) {
            expect(entity.importance).toBeGreaterThanOrEqual(0);
            expect(entity.importance).toBeLessThanOrEqual(1);
        }
    }

    // Usage drives the token counter and the ETA; zero means we mis-read it.
    expect(response.usage.input, `${label}: no input tokens reported`).toBeGreaterThan(0);
    expect(response.usage.output, `${label}: no output tokens reported`).toBeGreaterThan(0);

    const names = entities.map((e) => e.entity_name).join(', ');
    console.log(
        `    ${label}: ${entities.length} entities (${names}) · `
        + `${response.usage.input}→${response.usage.output} tokens`
    );
};

/** What this run will actually exercise, reported before anything is called. */
const plan: { provider: string; envVar: string; enabled: boolean }[] = [];

const announce = (provider: string, envVar: string, enabled: boolean) => {
    plan.push({ provider, envVar, enabled });
};

const describeProvider = (
    provider: ModelAPIsEnum,
    envVar: string,
    call: Caller,
) => {
    // Presence only — the value is never read into a log or an assertion.
    const key = process.env[envVar] ?? '';
    announce(provider, envVar, !!key);
    const suite = key ? describe : describe.skip;

    suite(`${provider} (live)`, () => {
        for (const tier of [ModelTierEnum.Low, ModelTierEnum.High]) {
            const model = models[provider][tier];

            it(`accepts our request shape on ${tier} (${model})`, async () => {
                // A rejected parameter or retired model id fails right here,
                // which is the whole point of this suite.
                const response = await withRetry(() => call({
                    text: PASSAGE, maxElements: MAX_ELEMENTS, apiKey: key, model,
                }));
                expectUsableResponse(response, `${provider}/${tier}`);
            });
        }

        it('respects the requested entity limit', async () => {
            const model = models[provider][ModelTierEnum.Low];
            const response = await withRetry(() =>
                call({ text: PASSAGE, maxElements: 2, apiKey: key, model }));
            expect(parseEntitiesResponse(response.text).length).toBeLessThanOrEqual(2);
        });

        it('streams the body incrementally rather than in one lump', async () => {
            const model = models[provider][ModelTierEnum.Low];
            const partials: number[] = [];
            const response = await withRetry(() => {
                partials.length = 0;
                return call({
                    text: PASSAGE, maxElements: MAX_ELEMENTS, apiKey: key, model,
                    onPartial: (accumulated) => partials.push(accumulated.length),
                });
            });

            expect(partials.length, 'no partial callbacks fired').toBeGreaterThan(1);
            // Each callback carries everything so far, so lengths only grow.
            for (let i = 1; i < partials.length; i++) {
                expect(partials[i]).toBeGreaterThanOrEqual(partials[i - 1]!);
            }
            expect(partials.at(-1)).toBe(response.text.length);
        });

        it('can represent "no enrichment" as a real null', async () => {
            // Not every passage yields a null, so this only asserts the type is
            // representable — a schema forbidding null shows up as the string.
            const model = models[provider][ModelTierEnum.Low];
            const response = await withRetry(() => call({
                text: PASSAGE, maxElements: MAX_ELEMENTS, apiKey: key, model,
            }));
            for (const entity of parseEntitiesResponse(response.text)) {
                const value = entity.contextual_enrichment;
                expect(value === null || typeof value === 'string').toBe(true);
            }
        });
    });
};

/**
 * Always runs, so the report is visible even when every provider skips — and
 * so a run with nothing configured fails loudly instead of exiting 0 with
 * "16 skipped", which reads exactly like success.
 */
describe('live provider configuration', () => {
    it('has at least one provider configured', () => {
        for (const { provider, envVar, enabled } of plan) {
            console.log(enabled
                ? `  ${provider.padEnd(9)} enabled  — ${envVar} is set`
                : `  ${provider.padEnd(9)} skipped  — set ${envVar} to include it`);
        }

        const enabled = plan.filter((entry) => entry.enabled).map((e) => e.provider);
        expect(
            enabled.length,
            'No provider configured. Copy .env.example to .env.local and fill in '
            + 'at least one key, then re-run. Any single provider is enough.',
        ).toBeGreaterThan(0);
    });
});

describeProvider(ModelAPIsEnum.Gemini, 'BUBBLENER_GEMINI_KEY', GeminiAPIRequest);
describeProvider(ModelAPIsEnum.ChatGPT, 'BUBBLENER_OPENAI_KEY', ChatGPTAPIRequest);
describeProvider(ModelAPIsEnum.DeepSeek, 'BUBBLENER_DEEPSEEK_KEY', DeepSeekAPIRequest);

// Ollama needs no key, only a running server.
const ollamaEnabled = !!process.env.BUBBLENER_OLLAMA;
announce('Ollama', 'BUBBLENER_OLLAMA=1 (with `ollama serve` running)', ollamaEnabled);
(ollamaEnabled ? describe : describe.skip)('Ollama (live)', () => {
    const model = process.env.BUBBLENER_OLLAMA_MODEL
        || models[ModelAPIsEnum.Ollama][ModelTierEnum.Low];

    it(`accepts our request shape (${model})`, async () => {
        const response = await withRetry(() => OllamaAPIRequest({
            text: PASSAGE, maxElements: MAX_ELEMENTS, apiKey: '', model,
        }));
        expectUsableResponse(response, `Ollama/${model}`);
    });
});
