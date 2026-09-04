import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import path from 'node:path';

/**
 * Live provider tests: real HTTP, real keys, real money.
 *
 * Deliberately a separate config so `npm test` can never pick these up. The
 * default suite mocks the SDKs, which means it verifies what we *send* but
 * never what a provider *accepts* — every API break this project has hit
 * (a rejected thinking parameter, a retired model id, a schema that forbade
 * null) was invisible to it.
 */
export default defineConfig(({ mode }) => ({
    resolve: {
        alias: { '@': path.resolve(__dirname, 'src') },
    },
    test: {
        environment: 'node',
        include: ['**/*.live.test.ts'],
        // One provider at a time keeps rate limits and output readable.
        fileParallelism: false,
        testTimeout: 120_000,
        // Diagnostics are the point here: entity names, token counts and the
        // enabled/skipped report must show even when the test passes, which
        // Vitest's console interception would otherwise swallow.
        disableConsoleIntercept: true,
        env: loadEnv(mode, process.cwd(), ''),
    },
}));
