import { readFileSync } from 'node:fs'
import path from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { getSql } from '@/db/client'
import { defaultTheme, LEGACY_LIME_THEME } from '@/theme/tokens'

/*
 * drizzle/0005_twilight_theme.sql moves saved content still on the original lime colours to the Twilight
 * defaults, once. The test database already ran it (empty), so each case stores content and runs the
 * same SQL again.
 */

const sql = () => getSql()
const MIGRATION = readFileSync(path.join(process.cwd(), 'drizzle', '0005_twilight_theme.sql'), 'utf8')
const LOGO = { src: '/media/0123456789abcdef01234567.png', alt: 'Club logo' }

async function store(key: 'draft' | 'published', theme: Record<string, unknown>) {
  await sql()`insert into site_documents (key, data) values (${key}, ${sql().json({ theme, ticker: ['kept'] })})`
}
const themeOf = async (key: string) => (await sql()`select data->'theme' as t, data->'ticker' as x from site_documents where key = ${key}`)[0]

beforeEach(async () => {
  await sql()`truncate site_documents, site_history`
})

describe('the Twilight theme migration', () => {
  it('gives content on the lime defaults the Twilight colours (the same as tokens.ts), keeping the logo and the rest', async () => {
    await store('published', { ...LEGACY_LIME_THEME, logo: LOGO })
    await sql().unsafe(MIGRATION)
    const row = await themeOf('published')
    expect(row.t).toEqual({ ...defaultTheme, logo: LOGO })
    expect(row.x).toEqual(['kept'])
  })

  it('treats hex letter case as the same colour, and a colour saved before it existed as unchosen', async () => {
    const { logoPlate: _missing, ...older } = LEGACY_LIME_THEME
    await store('draft', Object.fromEntries(Object.entries(older).map(([k, v]) => [k, v.toLowerCase()])))
    await sql().unsafe(MIGRATION)
    expect((await themeOf('draft')).t).toEqual(defaultTheme)
  })

  it('leaves a theme with any colour the owner picked exactly as it is', async () => {
    const mine = { ...LEGACY_LIME_THEME, accent: '#F06AA6', logo: LOGO }
    await store('published', mine)
    await sql().unsafe(MIGRATION)
    expect((await themeOf('published')).t).toEqual(mine)
  })
})
