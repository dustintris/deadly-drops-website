import { readFileSync } from 'node:fs'
import path from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { getSql } from '@/db/client'
import { ImageRef } from '@/lib/content-schema'
import { DEFAULT_RULES } from '../schema'

/*
 * drizzle/0007_tournament_flyers.sql puts the club's DOMINATE and VICTORY flyers on their tournaments, once,
 * where no flyer was chosen. The test database already ran it (no rows then), so each case stores rows and
 * runs the same SQL again.
 */

const sql = () => getSql()
const MIGRATION = readFileSync(path.join(process.cwd(), 'drizzle', '0007_tournament_flyers.sql'), 'utf8')

async function store(slug: string, flyer?: { src: string; alt: string }) {
  const info = { summary: 'A charity tournament.', dateLabel: 'Oct 17–18, 2026', entryFee: 65, includes: [], format: 'Round robin', prizes: [], registrationOpen: false, ...(flyer ? { flyer } : {}) }
  await sql()`insert into tournaments (slug, name, days, info, rules, visible) values (${slug}, ${slug}, ${['2026-10-17']}::date[], ${sql().json(info)}, ${sql().json(DEFAULT_RULES)}, true)`
}
const flyerOf = async (slug: string) => (await sql()`select info->'flyer' as f, version from tournaments where slug = ${slug}`)[0]

beforeEach(async () => {
  await sql()`truncate tournaments, divisions restart identity cascade`
})

describe('the tournament flyers migration', () => {
  it('gives DOMINATE and VICTORY their flyers, valid as the admin would save them', async () => {
    await store('dominate-2026')
    await store('victory-dink-for-pink-2026')
    await sql().unsafe(MIGRATION)
    const d = await flyerOf('dominate-2026')
    const v = await flyerOf('victory-dink-for-pink-2026')
    expect(d.f.src).toBe('/images/club/dominate-flyer.jpg')
    expect(v.f.src).toBe('/images/club/victory-flyer.jpg')
    expect(ImageRef.safeParse(d.f).success && ImageRef.safeParse(v.f).success).toBe(true)
    expect(d.version).toBe(2)
  })

  it('keeps a flyer the owner already chose, and touches no other tournament', async () => {
    const theirs = { src: '/media/0123456789abcdef01234567.jpg', alt: 'Their own flyer' }
    await store('victory-dink-for-pink-2026', theirs)
    await store('summer-slam-2027')
    await sql().unsafe(MIGRATION)
    await sql().unsafe(MIGRATION)
    expect((await flyerOf('victory-dink-for-pink-2026')).f).toEqual(theirs)
    expect((await flyerOf('summer-slam-2027')).f).toBeNull()
  })
})
