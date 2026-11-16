import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

/**
 * Unit + integration tests. Database tests run against a real throwaway
 * PostgreSQL 18 (embedded-postgres) started once in test/global-setup.ts.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // Next's guard module throws outside a server bundle; tests are server-side code.
      'server-only': fileURLToPath(new URL('./test/server-only.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    globalSetup: ['test/global-setup.ts'],
    setupFiles: ['test/setup-env.ts'],
    // One database for the whole run, so test files take turns.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 120_000,
  },
})
