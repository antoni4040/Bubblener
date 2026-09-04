import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // The popup tests drive Mantine through userEvent, which is slow enough to
    // pass the 5s default on a loaded machine and read as a flake.
    testTimeout: 20_000,
    // Live provider tests cost money and need real keys: they run only via
    // `npm run test:live`, never as part of the default suite.
    exclude: ['**/node_modules/**', 'e2e/**', '**/*.live.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/**/types/**', 'src/entrypoints/**'],
    },
  },
});
