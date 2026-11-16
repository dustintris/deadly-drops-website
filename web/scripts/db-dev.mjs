/**
 * `npm run db:dev`: a local PostgreSQL 18 for development, no Docker needed.
 * Data lives in web/.pgdata (git-ignored). Keep it running while you use `npm run dev`,
 * with this in web/.env.local:
 *
 *   DATABASE_URL=postgres://ddp:ddp-dev@127.0.0.1:54329/ddp
 */
import { existsSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import EmbeddedPostgres from 'embedded-postgres'

const dir = path.resolve('.pgdata')
const fresh = !existsSync(path.join(dir, 'PG_VERSION'))
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: 54329,
  user: 'ddp',
  password: 'ddp-dev',
  persistent: true,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  onLog: () => {},
})

if (fresh) await pg.initialise()
await pg.start()
if (fresh) await pg.createDatabase('ddp')
console.log('PostgreSQL ready: postgres://ddp:ddp-dev@127.0.0.1:54329/ddp  (Ctrl+C to stop)')

const stop = async () => {
  await pg.stop()
  process.exit(0)
}
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
