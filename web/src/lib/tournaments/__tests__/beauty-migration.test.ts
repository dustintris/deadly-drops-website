import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { getSql } from '@/db/client'
import { DEFAULT_RULES, Info, Rules } from '../schema'

/*
 * drizzle/0008_beauty_in_the_beast.sql adds Cherry's Beauty in the Beast weekend (Feb 20–21, 2027), once. The test
 * database already ran it, so each case starts from an empty table and runs the same SQL again.
 */

const sql = () => getSql()
const MIGRATION = readFileSync(path.join(process.cwd(), 'drizzle', '0008_beauty_in_the_beast.sql'), 'utf8')
const SLUG = 'beauty-in-the-beast-2027'
const rows = () => sql()`select name, days::text[] as days, info, rules, featured, visible from tournaments where slug = ${SLUG}`

beforeEach(async () => {
  await sql()`truncate tournaments, divisions restart identity cascade`
})

describe('the Beauty in the Beast migration', () => {
  it('adds the two-day weekend, visible and valid as the admin would save it', async () => {
    await sql().unsafe(MIGRATION)
    const [t] = await rows()
    expect(t.name).toBe('Beauty in the Beast')
    expect(t.days).toEqual(['2027-02-20', '2027-02-21'])
    expect(t.visible).toBe(true)
    // opening the editor and saving must not fail on anything the migration wrote
    const info = Info.safeParse(t.info)
    const rules = Rules.safeParse(t.rules)
    expect(info.success ? [] : info.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)).toEqual([])
    expect(rules.success ? [] : rules.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)).toEqual([])
    expect(t.info.entryFee).toBe(65)
    expect(t.info.registrationOpen).toBe(false)
    expect(t.rules.tiebreakers).toEqual(['pointsFor'])
    expect(t.rules.notes.map((n: { id: string }) => n.id)).toContain('moneyball')
    // the flyer it points at ships with the site
    expect(existsSync(path.join(process.cwd(), 'public', t.info.flyer.src))).toBe(true)
  })

  it('leaves the featured tournament alone (only one may be featured)', async () => {
    await sql()`insert into tournaments (slug, name, days, info, rules, featured, visible) values ('victory-dink-for-pink-2026', 'VICTORY', ${['2026-10-17']}::date[], ${sql().json({ summary: 'A charity tournament.' })}, ${sql().json(DEFAULT_RULES)}, true, true)`
    await sql().unsafe(MIGRATION)
    expect((await rows())[0].featured).toBe(false)
    expect((await sql()`select featured from tournaments where slug = 'victory-dink-for-pink-2026'`)[0].featured).toBe(true)
  })

  it('never duplicates it or overwrites the owner’s copy', async () => {
    await sql().unsafe(MIGRATION)
    await sql()`update tournaments set name = 'Beauty in the Beast Hybrid', visible = false where slug = ${SLUG}`
    await sql().unsafe(MIGRATION)
    const all = await rows()
    expect(all).toHaveLength(1)
    expect(all[0].name).toBe('Beauty in the Beast Hybrid')
    expect(all[0].visible).toBe(false)
  })
})
