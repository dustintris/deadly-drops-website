import { afterAll, inject } from 'vitest'

// Every test worker talks to the database started in global-setup.ts.
process.env.DATABASE_URL = inject('databaseUrl')

// Close this file's connection pool (src/db/client.ts keeps it on globalThis) so the run can exit.
afterAll(async () => {
  const g = globalThis as typeof globalThis & { __ddpSql?: { end: (o?: { timeout?: number }) => Promise<void> }; __ddpDb?: unknown }
  await g.__ddpSql?.end({ timeout: 5 })
  delete g.__ddpSql
  delete g.__ddpDb
})
