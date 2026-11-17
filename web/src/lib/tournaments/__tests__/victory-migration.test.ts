import { readFileSync } from 'node:fs'
import path from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { getSql } from '@/db/client'
import { DEFAULT_RULES, Rules } from '../schema'

/*
 * drizzle/0006_victory_two_days.sql fixes the saved VICTORY row once: two days (Oct 17–18) and the
 * pickle-meal note with Cherry's number. The test database already ran it (no rows then), so each case
 * stores a row and runs the same SQL again.
 */

const sql = () => getSql()
const MIGRATION = readFileSync(path.join(process.cwd(), 'drizzle', '0006_victory_two_days.sql'), 'utf8')
const SLUG = 'victory-dink-for-pink-2026'
const SEED_SUMMARY = 'Our second charity tournament of 2026: a one-day Breast Cancer and Halloween Bash at Better at Pickleball. Pink. Spooky. Friendly. Community-driven.'

/** The row as the seed import wrote it (or as the owner changed it). */
async function store(slug: string, over: { days?: string[]; dateLabel?: string; summary?: string; notes?: unknown[] } = {}) {
  const info = {
    summary: over.summary ?? SEED_SUMMARY,
    dateLabel: over.dateLabel ?? 'Sat, Oct 17, 2026',
    venue: 'Better at Pickleball, 2800 Olympic Parkway, Chula Vista, CA',
    entryFee: 65,
    includes: ['Pickle meal of your choice', 'Tournament shirt'],
    format: 'Round robin by age bracket and DUPR level',
    prizes: [],
    registrationOpen: false,
  }
  const rules = { ...DEFAULT_RULES, notes: over.notes ?? [] }
  await sql()`insert into tournaments (slug, name, days, info, rules, visible)
    values (${slug}, 'VICTORY: Dink for Pink', ${over.days ?? ['2026-10-17']}::date[], ${sql().json(info)}, ${sql().json(rules)}, true)`
}
async function row(slug = SLUG) {
  const [r] = await sql()`select days::text[] as days, info, rules, version from tournaments where slug = ${slug}`
  return r as { days: string[]; info: Record<string, unknown>; rules: { notes: { id: string; title: string; text: string }[] }; version: number }
}

beforeEach(async () => {
  await sql()`truncate tournaments, divisions restart identity cascade`
})

describe('the VICTORY two-day migration', () => {
  it('makes the seeded row two days, says so, and adds the pickle-meal note with Cherry’s number', async () => {
    await store(SLUG)
    await sql().unsafe(MIGRATION)
    const r = await row()
    expect(r.days).toEqual(['2026-10-17', '2026-10-18'])
    expect(r.info.dateLabel).toBe('Oct 17–18, 2026')
    expect(r.info.summary).toBe(SEED_SUMMARY.replace('a one-day', 'a two-day'))
    expect(r.info.venue).toBe('Better at Pickleball, 2800 Olympic Parkway, Chula Vista, CA') // the rest is kept
    expect(r.rules.notes).toEqual([
      { id: 'pickle-meal', title: 'Pickle meal', text: 'Text Cherry at (619) 988-4244 with your pickle meal of choice. Pickle meals and t-shirts are handed out at check-in.' },
    ])
    // still valid for the admin's rule editor, and an editor open on the old version gets a conflict
    expect(Rules.safeParse(r.rules).success).toBe(true)
    expect(r.version).toBe(2)
  })

  it('leaves what the owner already changed alone, adding the note after theirs', async () => {
    const theirs = { id: 'parking', title: 'Parking', text: 'Park on level 2.' }
    await store(SLUG, { days: ['2026-10-24'], dateLabel: 'Sat, Oct 24, 2026', summary: 'Moved a week later this year, same pink spirit.', notes: [theirs] })
    await sql().unsafe(MIGRATION)
    const r = await row()
    expect(r.days).toEqual(['2026-10-24'])
    expect(r.info.dateLabel).toBe('Sat, Oct 24, 2026')
    expect(r.info.summary).toBe('Moved a week later this year, same pink spirit.')
    expect(r.rules.notes.map((n) => n.id)).toEqual(['parking', 'pickle-meal'])
  })

  it('never adds the note twice, never past 20 notes, and touches no other tournament', async () => {
    await store(SLUG)
    await store('dominate-2026', { days: ['2026-10-17'], dateLabel: 'Sat, Oct 17, 2026' })
    await sql().unsafe(MIGRATION)
    await sql().unsafe(MIGRATION)
    expect((await row()).rules.notes).toHaveLength(1)
    const other = await row('dominate-2026')
    expect(other.days).toEqual(['2026-10-17'])
    expect(other.rules.notes).toEqual([])

    await sql()`truncate tournaments restart identity cascade`
    const full = Array.from({ length: 20 }, (_, i) => ({ id: `note-${i}`, title: `Note ${i}`, text: 'Something.' }))
    await store(SLUG, { notes: full })
    await sql().unsafe(MIGRATION)
    expect((await row()).rules.notes).toHaveLength(20)
  })
})
