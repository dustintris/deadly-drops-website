import { readFileSync } from 'node:fs'
import path from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { getSql } from '@/db/client'
import { buildSeed } from '@/content/seed'
import { SECTIONS } from '@/lib/content-schema'

/*
 * drizzle/0010_retire_preview_content.sql takes the mockup's "Preview build" banner and 15% member discount out of
 * content saved before launch. The test database already ran it (empty), so each case stores content and runs it again.
 */

const sql = () => getSql()
const MIGRATION = readFileSync(path.join(process.cwd(), 'drizzle', '0010_retire_preview_content.sql'), 'utf8')
const PREVIEW = { enabled: true, text: 'Preview build · member names and ratings are sample content' }
const HOW_TO_BUY = 'Buy at tournament check-in, or message us to hold your size.'

async function store(key: 'draft' | 'published', notice: object, shop: object) {
  const seed = buildSeed()
  const data = { ...seed, settings: { ...seed.settings, notice, shop } }
  await sql()`insert into site_documents (key, data) values (${key}, ${sql().json(data)})`
}
const settingsOf = async (key: string) => (await sql()`select data->'settings' as s from site_documents where key = ${key}`)[0].s

beforeEach(async () => {
  await sql()`truncate site_documents, site_history`
})

describe('the retire-preview-content migration', () => {
  it('turns the preview banner off and the member discount to 0 in a draft saved before launch, valid as the admin saves it', async () => {
    await store('draft', PREVIEW, { memberDiscount: 0.15, pickupNote: '' })
    await sql().unsafe(MIGRATION)
    const s = await settingsOf('draft')
    expect(s.notice).toEqual({ enabled: false, text: '' })
    expect(s.shop).toEqual({ memberDiscount: 0, pickupNote: HOW_TO_BUY })
    expect(SECTIONS.settings.safeParse(s).success).toBe(true)
    // the rest of the settings are untouched
    expect(s.name).toBe(buildSeed().settings.name)
  })

  it('keeps a banner, discount and note the owner wrote, and runs again harmlessly', async () => {
    const theirs = { enabled: true, text: 'Registration for Beauty in the Beast opens soon!', href: '/tournaments/' }
    await store('published', theirs, { memberDiscount: 0.1, pickupNote: 'Pick up at the Saturday ladder.' })
    await sql().unsafe(MIGRATION)
    await sql().unsafe(MIGRATION)
    const s = await settingsOf('published')
    expect(s.notice).toEqual(theirs)
    expect(s.shop).toEqual({ memberDiscount: 0.1, pickupNote: 'Pick up at the Saturday ladder.' })
  })
})
