import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { getSql } from '@/db/client'
import { ImageRef } from '@/lib/content-schema'
import { tournamentImageUsage } from '../repo'
import { DEFAULT_RULES, Info } from '../schema'

/*
 * drizzle/0011_tournament_medals.sql puts the VICTORY and DOMINATE medals on their tournaments, once, where no
 * medal was chosen. The test database already ran it (no rows then), so each case stores rows and runs it again.
 */

const sql = () => getSql()
const MIGRATION = readFileSync(path.join(process.cwd(), 'drizzle', '0011_tournament_medals.sql'), 'utf8')
const BASE = { summary: 'A charity tournament.', dateLabel: 'Oct 17–18, 2026', entryFee: 65, includes: [], format: 'Round robin', prizes: [], registrationOpen: false }

async function store(slug: string, extra: Record<string, unknown> = {}) {
  await sql()`insert into tournaments (slug, name, days, info, rules, visible) values (${slug}, ${slug}, ${['2026-10-17']}::date[], ${sql().json({ ...BASE, ...extra })}, ${sql().json(DEFAULT_RULES)}, true)`
}
const infoOf = async (slug: string) => (await sql()`select info, version from tournaments where slug = ${slug}`)[0]

beforeEach(async () => {
  await sql()`truncate tournaments, divisions restart identity cascade`
})

describe('the tournament medals migration', () => {
  it('gives VICTORY and DOMINATE their medals, valid as the admin would save them', async () => {
    await store('victory-dink-for-pink-2026')
    await store('dominate-2026')
    await sql().unsafe(MIGRATION)
    for (const [slug, src] of [['victory-dink-for-pink-2026', '/images/club/victory-medal.jpg'], ['dominate-2026', '/images/club/dominate-medal.jpg']]) {
      const row = await infoOf(slug)
      expect(row.info.medal.src).toBe(src)
      expect(ImageRef.safeParse(row.info.medal).success).toBe(true)
      expect(Info.safeParse(row.info).success).toBe(true)
      expect(row.version).toBe(2)
      // the picture it points at ships with the site
      expect(existsSync(path.join(process.cwd(), 'public', src))).toBe(true)
    }
  })

  it('keeps a medal the owner already chose, and touches no other tournament', async () => {
    const theirs = { src: '/media/0123456789abcdef01234567.jpg', alt: 'Their own medal photo' }
    await store('victory-dink-for-pink-2026', { medal: theirs, medalNote: 'Gold, silver and bronze in every division' })
    await store('beauty-in-the-beast-2027')
    await sql().unsafe(MIGRATION)
    await sql().unsafe(MIGRATION)
    const victory = await infoOf('victory-dink-for-pink-2026')
    expect(victory.info.medal).toEqual(theirs)
    expect(victory.info.medalNote).toBe('Gold, silver and bronze in every division')
    expect(victory.version).toBe(1)
    expect((await infoOf('beauty-in-the-beast-2027')).info.medal).toBeUndefined()
  })
})

describe('medal fields', () => {
  it('are optional, take a note of at most 160 characters, and only take pictures from the library', () => {
    expect(Info.safeParse(BASE).success).toBe(true)
    const img = { src: '/media/0123456789abcdef01234567.jpg', alt: 'Medal' }
    expect(Info.safeParse({ ...BASE, medal: img, medalBack: img, medalNote: 'Gold, silver and bronze' }).success).toBe(true)
    expect(Info.safeParse({ ...BASE, medalNote: 'x'.repeat(161) }).success).toBe(false)
    expect(Info.safeParse({ ...BASE, medal: { src: 'https://example.com/medal.jpg', alt: '' } }).success).toBe(false)
    // a second view without the main picture would never show: the editor asks for the main one
    const backOnly = Info.safeParse({ ...BASE, medalBack: img })
    expect(backOnly.success ? [] : backOnly.error.issues.map((i) => i.path.join('.'))).toEqual(['medalBack'])
  })

  it('keep a medal picture from being deleted while a tournament shows it', async () => {
    await store('victory-dink-for-pink-2026', { medalBack: { src: '/media/aaaaaaaaaaaaaaaaaaaaaaaa.jpg', alt: 'Back' } })
    await sql().unsafe(MIGRATION)
    expect(await tournamentImageUsage('/images/club/victory-medal.jpg')).toEqual(['Tournament: victory-dink-for-pink-2026'])
    expect(await tournamentImageUsage('/media/aaaaaaaaaaaaaaaaaaaaaaaa.jpg')).toEqual(['Tournament: victory-dink-for-pink-2026'])
  })
})
