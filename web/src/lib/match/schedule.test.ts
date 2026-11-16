import { describe, expect, it } from 'vitest'
import { describePlan, formatTime12, scheduleDivision } from './schedule'

const base = {
  gamesPerTeam: 7,
  startTime: '08:00',
  minutesPerRound: 20,
  firstCourt: 1,
  courtCount: 4,
}
const ids = (n: number) => Array.from({ length: n }, (_, i) => i + 1)

describe('scheduleDivision', () => {
  it('8 teams on 4 courts: 7 rounds, 28 matches, one slot per round', () => {
    const m = scheduleDivision({ ...base, teamIds: ids(8), seed: 1 })
    expect(m).toHaveLength(28)
    expect(Math.max(...m.map((x) => x.round))).toBe(7)
    expect(m.every((x) => x.slot === x.round)).toBe(true)
    expect(new Set(m.map((x) => x.court))).toEqual(new Set([1, 2, 3, 4]))
  })

  it('offsets courts by firstCourt', () => {
    const m = scheduleDivision({ ...base, teamIds: ids(8), firstCourt: 5, seed: 1 })
    expect(new Set(m.map((x) => x.court))).toEqual(new Set([5, 6, 7, 8]))
  })

  it('computes start times from the slot index', () => {
    const m = scheduleDivision({ ...base, teamIds: ids(8), seed: 1 })
    expect(m.find((x) => x.slot === 1)!.startsAt).toBe('08:00')
    expect(m.find((x) => x.slot === 2)!.startsAt).toBe('08:20')
    expect(m.find((x) => x.slot === 4)!.startsAt).toBe('09:00')
  })

  it('splits a round into several slots when courts are short', () => {
    const m = scheduleDivision({ ...base, teamIds: ids(8), courtCount: 2, seed: 1 })
    expect(m).toHaveLength(28)
    for (const slot of new Set(m.map((x) => x.slot))) {
      expect(m.filter((x) => x.slot === slot).length).toBeLessThanOrEqual(2)
    }
    expect(m.filter((x) => x.round === 1).every((x) => x.slot <= 2)).toBe(true)
    expect(m.filter((x) => x.round === 2).every((x) => x.slot >= 3)).toBe(true)
    expect(m.filter((x) => x.slot === 1).map((x) => x.court)).toEqual([1, 2])
  })

  it('is deterministic for a seed and differs across seeds', () => {
    const a = scheduleDivision({ ...base, teamIds: ids(8), seed: 42 })
    const b = scheduleDivision({ ...base, teamIds: ids(8), seed: 42 })
    const c = scheduleDivision({ ...base, teamIds: ids(8), seed: 43 })
    expect(a).toEqual(b)
    expect(a).not.toEqual(c)
  })

  it('uses only the given team ids and gives each the planned games', () => {
    const teamIds = [10, 20, 30, 40, 50, 60]
    const m = scheduleDivision({ ...base, teamIds, seed: 3 })
    const counts = new Map<number, number>()
    for (const x of m) {
      for (const t of [x.teamA, x.teamB]) counts.set(t, (counts.get(t) ?? 0) + 1)
    }
    expect([...counts.keys()].sort((p, q) => p - q)).toEqual(teamIds)
    expect([...counts.values()]).toEqual(new Array(6).fill(7))
  })

  it('does not mutate the input array', () => {
    const teamIds = ids(8)
    scheduleDivision({ ...base, teamIds, seed: 9 })
    expect(teamIds).toEqual(ids(8))
  })

  it('works without a seed (Math.random)', () => {
    expect(scheduleDivision({ ...base, teamIds: ids(8) })).toHaveLength(28)
  })

  it('returns nothing for fewer than 2 teams or no courts', () => {
    expect(scheduleDivision({ ...base, teamIds: [1] })).toEqual([])
    expect(scheduleDivision({ ...base, teamIds: ids(8), courtCount: 0 })).toEqual([])
  })

  it('wraps past midnight', () => {
    const m = scheduleDivision({ ...base, teamIds: ids(4), startTime: '23:50', seed: 1 })
    expect(m.find((x) => x.slot === 2)!.startsAt).toBe('00:10')
  })
})

describe('formatTime12', () => {
  it('formats times', () => {
    expect(formatTime12('08:00')).toBe('8:00 AM')
    expect(formatTime12('00:05')).toBe('12:05 AM')
    expect(formatTime12('12:00')).toBe('12:00 PM')
    expect(formatTime12('13:30')).toBe('1:30 PM')
  })
})

describe('describePlan', () => {
  it('describes a full round robin', () => {
    expect(describePlan(8, 7)).toBe(
      '8 teams: 7 rounds on 4 courts, 7 games each. Everyone plays everyone once.',
    )
  })
  it('describes rematch rounds', () => {
    expect(describePlan(6, 7)).toContain('then 2 rematch rounds toward the 7 promised')
  })
  it('describes a double round robin', () => {
    expect(describePlan(4, 6)).toContain('double round robin')
  })
  it('explains when the target cannot be shared evenly', () => {
    expect(describePlan(7, 7)).toContain('cannot be shared evenly')
    expect(describePlan(7, 7)).toContain('Set 8 to go over')
  })
  it('uses singular court', () => {
    expect(describePlan(2, 1)).toContain('1 court,')
  })
})
