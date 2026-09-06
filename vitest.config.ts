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
    // The popup tests drive Mantine through userEvent and take ~27s for the
    // file even on an idle machine. Running alongside the rest of the suite
    // they were passing 20s and failing as timeouts rather than on their
    // assertions — a flake, not a defect. CI runners are slower again.
    testTimeout: 45_000,
    // Live provider tests cost money and need real keys: they run only via
    // `npm run test:live`, never as part of the default suite.
    // `.claude/worktrees/**` holds throwaway git worktrees of this same repo.
    // Without it the suite collects a second copy of every test, which then
    // fails for the wrong reason: a worktree has no `node_modules` or `.wxt`.
    exclude: [
      '**/node_modules/**', 'e2e/**', '**/*.live.test.ts', '.claude/**',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/**/types/**', 'src/entrypoints/**'],
    },
  },
});
