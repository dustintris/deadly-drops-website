import 'server-only'
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

export type Db = PostgresJsDatabase<typeof schema>

/*
 * One connection pool per server process, created on first use (never at import,
 * so `next build` works without a database). Kept on globalThis so dev-mode hot
 * reloads don't open a new pool each time.
 */
const g = globalThis as typeof globalThis & { __ddpSql?: postgres.Sql; __ddpDb?: Db }

export function getSql(): postgres.Sql {
  if (!g.__ddpSql) {
    const url = process.env.DATABASE_URL
    if (!url) throw new Error('DATABASE_URL is not set. Run `npm run db:dev` locally, or set it in the server .env.')
    g.__ddpSql = postgres(url, {
      max: 10,
      idle_timeout: 30,
      connect_timeout: 10,
      onnotice: () => {},
    })
  }
  return g.__ddpSql
}

export function getDb(): Db {
  g.__ddpDb ??= drizzle(getSql(), { schema })
  return g.__ddpDb
}
