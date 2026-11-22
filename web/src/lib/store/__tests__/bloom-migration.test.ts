import { readFileSync } from 'node:fs'
import path from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { getSql } from '@/db/client'
import { Theme } from '@/lib/content-schema'
import { BLOOM_THEME, BLOSSOM_BRIGHT_THEME, BLOSSOM_THEME } from '@/theme/tokens'

/*
 * drizzle/0015_bloom_theme.sql moves saved content still on the Blossom-bright colours to Bloom, once.
 * The test database already ran it (empty), so each case stores content and runs the same SQL again.
 */

const sql = () => getSql()
const MIGRATION = readFileSync(path.join(process.cwd(), 'drizzle', '0015_bloom_theme.sql'), 'utf8')
const LOGO = { src: '/media/0123456789abcdef01234567.png', alt: 'Club logo' }
const BEFORE = '2026-01-01T00:00:00.000Z'

async function store(key: 'draft' | 'published', theme: Record<string, unknown>) {
  await sql()`insert into site_documents (key, data, updated_at) values (${key}, ${sql().json({ theme, ticker: ['kept'] })}, ${BEFORE})`
}
const rowOf = async (key: string) =>
  (await sql()`select data->'theme' as t, data->'ticker' as x, updated_at as at from site_documents where key = ${key}`)[0]

beforeEach(async () => {
  await sql()`truncate site_documents, site_history`
})

describe('the Bloom migration', () => {
  it('writes the Bloom colours and matches on the Blossom-bright colours, both exactly as in tokens.ts', () => {
    // the SQL's two palettes, in order: the colours it sets, then the colours it looks for (not the empty '{}')
    const palettes = [...MIGRATION.matchAll(/'(\{\s*"[^']*\})'::jsonb/g)].map((m) => JSON.parse(m[1]))
    expect(palettes).toEqual([BLOOM_THEME, BLOSSOM_BRIGHT_THEME])
  })

  it('moves a draft on the Blossom-bright colours to Bloom, keeping the logo, other theme keys and the rest', async () => {
    await store('draft', { ...BLOSSOM_BRIGHT_THEME, logo: LOGO, extra: 'kept' })
    await sql().unsafe(MIGRATION)
    const row = await rowOf('draft')
    expect(row.t).toEqual({ ...BLOOM_THEME, logo: LOGO, extra: 'kept' })
    expect(row.x).toEqual(['kept'])
    expect(new Date(row.at).toISOString()).not.toBe(BEFORE) // marked as changed
    // valid as the admin saves it: every readability check passes
    const { extra: _extra, ...saved } = row.t
    expect(Theme.safeParse(saved).success).toBe(true)
  })

  it('moves the live theme as it was saved: lowercase text colour and a changed initials tint (unused on the site)', async () => {
    await store('published', { ...BLOSSOM_BRIGHT_THEME, ink: '#f9f9f9', accentTint: '#E42278' })
    await sql().unsafe(MIGRATION)
    expect((await rowOf('published')).t).toEqual(BLOOM_THEME)
  })

  it('treats a colour saved before it existed as unchosen', async () => {
    const { logoPlate: _missing, ...older } = BLOSSOM_BRIGHT_THEME
    await store('published', older)
    await sql().unsafe(MIGRATION)
    expect((await rowOf('published')).t).toEqual(BLOOM_THEME)
  })

  it('leaves a theme with any other colour the owner picked exactly as it is, and the other row still moves', async () => {
    const mine = { ...BLOSSOM_BRIGHT_THEME, accent: '#F06AA6', logo: LOGO }
    await store('published', mine)
    await store('draft', { ...BLOSSOM_BRIGHT_THEME })
    await sql().unsafe(MIGRATION)
    const live = await rowOf('published')
    expect(live.t).toEqual(mine)
    expect(new Date(live.at).toISOString()).toBe(BEFORE)
    expect((await rowOf('draft')).t).toEqual(BLOOM_THEME)
  })

  it('leaves the navy Blossom alone, and runs again harmlessly', async () => {
    await store('published', { ...BLOSSOM_THEME, logo: LOGO })
    await store('draft', { ...BLOSSOM_BRIGHT_THEME, logo: LOGO })
    await sql().unsafe(MIGRATION)
    await sql().unsafe(MIGRATION)
    expect((await rowOf('published')).t).toEqual({ ...BLOSSOM_THEME, logo: LOGO })
    expect((await rowOf('draft')).t).toEqual({ ...BLOOM_THEME, logo: LOGO })
  })
})
