import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import type { TestProject } from 'vitest/node'
import { runMigrations } from '../src/db/migrate'

declare module 'vitest' {
  export interface ProvidedContext {
    databaseUrl: string
  }
}

/** Start a throwaway PostgreSQL, apply the real migrations, hand the URL to the test workers. */
export default async function setup(project: TestProject) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'ddp-pg-'))
  const port = 55_000 + Math.floor(Math.random() * 1_000)
  const pg = new EmbeddedPostgres({
    databaseDir: dir,
    port,
    user: 'ddp',
    password: 'ddp-test',
    persistent: false,
    // Postgres refuses to run as root (some containers): run it as the postgres user and give it the data dir.
    createPostgresUser: process.getuid?.() === 0,
    // Windows defaults to a legacy code page; the site's copy needs UTF-8 (same as the server).
    initdbFlags: ['--encoding=UTF8', '--locale=C'],
    onLog: () => {},
  })
  await pg.initialise()
  await pg.start()
  await pg.createDatabase('ddp_test')

  const url = `postgres://ddp:ddp-test@127.0.0.1:${port}/ddp_test`
  await runMigrations(url)
  project.provide('databaseUrl', url)

  return async () => {
    await pg.stop()
    await rm(dir, { recursive: true, force: true })
  }
}
