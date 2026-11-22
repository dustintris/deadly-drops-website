import { describe, expect, it } from 'vitest'
import { buildSeed } from '@/content/seed'
import { Volunteers } from '../content-schema'
import type { ClubEvent } from '../types'
import { comingUp, roleTone } from '../volunteers'

const event = (slug: string, date: string | null, extra: Partial<ClubEvent> = {}): ClubEvent => ({
  slug, name: slug, summary: '', date, dateLabel: date ?? 'Date to be announced', entryFee: 55, includes: [], format: 'Round robin',
  prizes: [], registrationOpen: false, ...extra,
})

// noon in Chula Vista on 2026-11-22, so the club's "today" is that date whatever the machine's time zone
const NOW = new Date('2026-11-22T20:00:00Z')

describe('comingUp', () => {
  it('leaves out tournaments that are over and lists the rest the latest first', () => {
    const list = [event('spring', '2027-04-10'), event('summer', '2026-06-13'), event('winter', '2026-12-05')]
    expect(comingUp(list, NOW).map((e) => e.slug)).toEqual(['spring', 'winter'])
  })

  it('keeps a tournament on its last day, and one running over several days until it ends', () => {
    const list = [event('today', '2026-11-22'), event('weekend', '2026-11-21', { endDate: '2026-11-23' }), event('yesterday', '2026-11-21')]
    expect(comingUp(list, NOW).map((e) => e.slug)).toEqual(['today', 'weekend'])
  })

  it('puts tournaments without a date first (the newest announcements), in their own order', () => {
    const list = [event('tba-b', null), event('dated', '2027-01-09'), event('tba-a', null, { registrationOpen: true })]
    expect(comingUp(list, NOW).map((e) => e.slug)).toEqual(['tba-b', 'tba-a', 'dated'])
  })

  it('keeps the `limit` soonest (they need help first), and nothing for an empty or all-past season', () => {
    const list = ['2027-01-01', '2027-02-01', '2027-03-01', '2027-04-01', '2027-05-01'].map((d) => event(d, d))
    expect(comingUp(list, NOW)).toHaveLength(4)
    expect(comingUp(list, NOW, 2).map((e) => e.slug)).toEqual(['2027-02-01', '2027-01-01'])
    expect(comingUp(list, NOW, -1)).toEqual([])
    expect(comingUp([], NOW)).toEqual([])
    expect(comingUp([event('old', '2025-05-01')], NOW)).toEqual([])
  })

  it('does not reorder the list it was given', () => {
    const list = [event('b', '2027-02-01'), event('a', '2027-01-01')]
    comingUp(list, NOW)
    expect(list.map((e) => e.slug)).toEqual(['b', 'a'])
  })
})

describe('roleTone', () => {
  it('makes the first card black and the fifth pink, repeating every six', () => {
    expect(Array.from({ length: 12 }, (_, i) => roleTone(i))).toEqual([
      'dark', 'card', 'card', 'card', 'accent', 'card',
      'dark', 'card', 'card', 'card', 'accent', 'card',
    ])
  })
})

describe('Volunteers content', () => {
  it('ships a valid default: roles with ids the schema accepts, sign-ups open', () => {
    const seed = buildSeed().volunteers
    expect(Volunteers.parse(seed)).toEqual(seed)
    expect(seed.roles.length).toBeGreaterThan(0)
    expect(seed.signupOpen).toBe(true)
  })

  it('drops blank perk lines (the editor sends one per line) and caps the list at six', () => {
    const base = buildSeed().volunteers
    expect(Volunteers.parse({ ...base, perks: ['Volunteer shirt', '', '  ', 'Lunch on the day'] }).perks).toEqual(['Volunteer shirt', 'Lunch on the day'])
    expect(Volunteers.safeParse({ ...base, perks: ['a1', 'b2', 'c3', 'd4', 'e5', 'f6', 'g7'] }).success).toBe(false)
  })

  it('rejects a role id the editor could never make', () => {
    const base = buildSeed().volunteers
    const bad = { ...base, roles: [{ ...base.roles[0], id: 'Bad Id' }] }
    expect(Volunteers.safeParse(bad).success).toBe(false)
  })
})
