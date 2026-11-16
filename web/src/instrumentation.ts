/**
 * Runs once when the Next.js server starts: bring the database schema up to date
 * before serving any request. A failed migration stops the server (and the
 * container restarts) instead of serving pages against the wrong schema.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  if (process.env.NEXT_PHASE === 'phase-production-build') return
  if (!process.env.DATABASE_URL) {
    // In production a missing database is a misconfiguration: refuse to start so the container restarts loudly.
    if (process.env.NODE_ENV === 'production') throw new Error('DATABASE_URL is required in production')
    console.warn('[db] DATABASE_URL is not set: skipping migrations (pages that need the database will fail)')
    return
  }
  const { runMigrations } = await import('./db/migrate')
  await runMigrations()
  console.log('[db] migrations up to date')
}
