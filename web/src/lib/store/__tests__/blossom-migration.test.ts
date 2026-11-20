import { readFileSync } from 'node:fs'
import path from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { getSql } from '@/db/client'
import { Theme } from '@/lib/content-schema'
import { BLOSSOM_THEME, LEGACY_LIME_THEME, TWILIGHT_THEME } from '@/theme/tokens'

/*
 * drizzle/0012_blossom_theme.sql moves saved content still on the Twilight colours to the Blossom defaults, once.
 * The test database already ran it (empty), so each case stores content and runs the same SQL again.
 */

const sql = () => getSql()
const MIGRATION = readFileSync(path.join(process.cwd(), 'drizzle', '0012_blossom_theme.sql'), 'utf8')
const LOGO = { src: '/media/0123456789abcdef01234567.png', alt: 'Club logo' }

async function store(key: 'draft' | 'published', theme: Record<string, unknown>) {
  await sql()`insert into site_documents (key, data, updated_at) values (${key}, ${sql().json({ theme, ticker: ['kept'] })}, '2026-01-01T00:00:00Z')`
}
const rowOf = async (key: string) =>
  (await sql()`select data->'theme' as t, data->'ticker' as x, updated_at as at from site_documents where key = ${key}`)[0]

beforeEach(async () => {
  await sql()`truncate site_documents, site_history`
})

describe('the Blossom theme migration', () => {
  it('writes the Blossom colours and matches on the Twilight colours, both exactly as in tokens.ts', () => {
    // the SQL's two palettes, in order: the colours it sets, then the colours it looks for (not the empty '{}')
    const palettes = [...MIGRATION.matchAll(/'(\{\s*"[^']*\})'::jsonb/g)].map((m) => JSON.parse(m[1]))
    expect(palettes).toEqual([BLOSSOM_THEME, TWILIGHT_THEME])
  })

  it('gives a draft on the Twilight defaults the Blossom colours, keeping the logo, other theme keys and the rest', async () => {
    await store('draft', { ...TWILIGHT_THEME, logo: LOGO, extra: 'kept' })
    await sql().unsafe(MIGRATION)
    const row = await rowOf('draft')
    expect(row.t).toEqual({ ...BLOSSOM_THEME, logo: LOGO, extra: 'kept' })
    expect(row.x).toEqual(['kept'])
    expect(new Date(row.at).toISOString()).not.toBe('2026-01-01T00:00:00.000Z') // marked as changed
    // valid as the admin saves it: every readability check passes
    const { extra: _extra, ...saved } = row.t
    expect(Theme.safeParse(saved).success).toBe(true)
  })

  it('treats hex letter case as the same colour, and a colour saved before it existed as unchosen', async () => {
    const { logoPlate: _missing, ...older } = TWILIGHT_THEME
    await store('published', Object.fromEntries(Object.entries(older).map(([k, v]) => [k, v.toLowerCase()])))
    await sql().unsafe(MIGRATION)
    expect((await rowOf('published')).t).toEqual(BLOSSOM_THEME)
  })

  it('leaves a theme with any colour the owner picked exactly as it is, and the other row still moves', async () => {
    const mine = { ...TWILIGHT_THEME, accent: '#F06AA6', logo: LOGO }
    await store('published', mine)
    await store('draft', { ...TWILIGHT_THEME })
    await sql().unsafe(MIGRATION)
    const live = await rowOf('published')
    expect(live.t).toEqual(mine)
    expect(new Date(live.at).toISOString()).toBe('2026-01-01T00:00:00.000Z')
    expect((await rowOf('draft')).t).toEqual(BLOSSOM_THEME)
  })

  it('leaves the Lime and Blossom palettes alone, and runs again harmlessly', async () => {
    await store('published', { ...LEGACY_LIME_THEME, logo: LOGO })
    await store('draft', { ...TWILIGHT_THEME, logo: LOGO })
    await sql().unsafe(MIGRATION)
    await sql().unsafe(MIGRATION)
    expect((await rowOf('published')).t).toEqual({ ...LEGACY_LIME_THEME, logo: LOGO })
    expect((await rowOf('draft')).t).toEqual({ ...BLOSSOM_THEME, logo: LOGO })
  })
})
