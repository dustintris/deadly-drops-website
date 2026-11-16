import { describe, expect, it } from 'vitest'
import { generateRoundRobin } from './roundRobin'
import { isGameComplete, winnerOf } from './scoring'
import { computeStandings } from './standings'

describe('generateRoundRobin', () => {
  it('produces a complete 7-round schedule for 8 teams', () => {
    const ids = [1, 2, 3, 4, 5, 6, 7, 8]
    const rounds = generateRoundRobin(ids)
    expect(rounds).toHaveLength(7)

    const seenPairs = new Set<string>()
    for (const round of rounds) {
      expect(round).toHaveLength(4)
      const inRound = new Set<number>()
      for (const [a, b] of round) {
        expect(inRound.has(a)).toBe(false)
        expect(inRound.has(b)).toBe(false)
        inRound.add(a)
        inRound.add(b)
        seenPairs.add(`${Math.min(a, b)}-${Math.max(a, b)}`)
      }
    }
    expect(seenPairs.size).toBe(28)
  })

  it('gives each team one bye with an odd team count', () => {
    const rounds = generateRoundRobin([1, 2, 3])
    expect(rounds).toHaveLength(3)
    for (const round of rounds) {
      expect(round).toHaveLength(1)
    }
    const appearances = new Map<number, number>()
    for (const round of rounds) {
      for (const [a, b] of round) {
        appearances.set(a, (appearances.get(a) ?? 0) + 1)
        appearances.set(b, (appearances.get(b) ?? 0) + 1)
      }
    }
    expect([...appearances.values()]).toEqual([2, 2, 2])
  })

  it('returns nothing for fewer than two teams', () => {
    expect(generateRoundRobin([])).toEqual([])
    expect(generateRoundRobin([1])).toEqual([])
  })
})

describe('computeStandings', () => {
  it('ranks by wins, then point differential', () => {
    const standings = computeStandings(
      [1, 2, 3],
      [
        { teamA: 1, teamB: 2, scoreA: 11, scoreB: 5 },
        { teamA: 2, teamB: 3, scoreA: 11, scoreB: 9 },
        { teamA: 3, teamB: 1, scoreA: 11, scoreB: 9 },
      ],
    )
    // Everyone is 1-1; point differentials are +4 / 0 / -4 for teams 1 / 3 / 2.
    expect(standings.map((s) => s.teamId)).toEqual([1, 3, 2])
    expect(standings.map((s) => s.rank)).toEqual([1, 2, 3])
    expect(standings[0].pointDiff).toBe(4)
    expect(standings[2].pointDiff).toBe(-4)
  })

  it('accumulates points for and against per team', () => {
    const [first] = computeStandings(
      [1, 2],
      [
        { teamA: 1, teamB: 2, scoreA: 11, scoreB: 7 },
        { teamA: 2, teamB: 1, scoreA: 4, scoreB: 11 },
      ],
    )
    expect(first.teamId).toBe(1)
    expect(first.wins).toBe(2)
    expect(first.pointsFor).toBe(22)
    expect(first.pointsAgainst).toBe(11)
    expect(first.pointWinPct).toBeCloseTo(22 / 33)
  })

  it('leaves teams with no games at zero', () => {
    const standings = computeStandings([1, 2], [])
    expect(standings[0].gamesPlayed).toBe(0)
    expect(standings[0].pointWinPct).toBe(0)
  })
})

describe('isGameComplete', () => {
  it('completes at the target with a clear lead', () => {
    expect(isGameComplete(11, 7, 11, true)).toBe(true)
    expect(isGameComplete(7, 11, 11, true)).toBe(true)
    expect(isGameComplete(15, 13, 15, true)).toBe(true)
    expect(isGameComplete(10, 8, 11, true)).toBe(false) // target not reached
    expect(isGameComplete(5, 3, 11, true)).toBe(false) // mid-game
  })

  it('deuce: at 10-10 play continues past 11 until the lead is 2', () => {
    expect(isGameComplete(10, 10, 11, true)).toBe(false)
    expect(isGameComplete(11, 10, 11, true)).toBe(false) // still live
    expect(isGameComplete(12, 10, 11, true)).toBe(true)
    expect(isGameComplete(13, 12, 11, true)).toBe(false)
    expect(isGameComplete(14, 12, 11, true)).toBe(true)
  })

  it('without win-by-2 the target alone decides', () => {
    expect(isGameComplete(11, 10, 11, false)).toBe(true)
    expect(isGameComplete(10, 9, 11, false)).toBe(false)
  })

  it('never completes a tied score', () => {
    expect(isGameComplete(11, 11, 11, false)).toBe(false)
    expect(isGameComplete(12, 12, 11, true)).toBe(false)
  })
})

describe('configurable tie-breakers', () => {
  it('head-to-head beats a better point differential when ranked first', () => {
    // Teams 1 and 2 are both 1-1. Team 2 has the far better differential,
    // but team 1 won their meeting.
    const results = [
      { teamA: 1, teamB: 2, scoreA: 11, scoreB: 9 }, // 1 beats 2
      { teamA: 3, teamB: 1, scoreA: 11, scoreB: 0 }, // team 1 PD: +2 - 11 = -9
      { teamA: 2, teamB: 4, scoreA: 11, scoreB: 0 }, // team 2 PD: -2 + 11 = +9
      { teamA: 3, teamB: 4, scoreA: 11, scoreB: 9 }, // 3 finishes 2-0, 4 finishes 0-2
    ]
    const withH2H = computeStandings([1, 2, 3, 4], results, ['headToHead', 'pointDiff'])
    expect(withH2H.map((s) => s.teamId)).toEqual([3, 1, 2, 4])
    const withoutH2H = computeStandings([1, 2, 3, 4], results, ['pointDiff'])
    expect(withoutH2H.map((s) => s.teamId)).toEqual([3, 2, 1, 4])
  })

  it('falls through a circular head-to-head tie to the next rule', () => {
    // A beats B, B beats C, C beats A all 1-1 within the group, so
    // head-to-head cannot separate them and point differential decides.
    const results = [
      { teamA: 1, teamB: 2, scoreA: 11, scoreB: 3 }, // A +8
      { teamA: 2, teamB: 3, scoreA: 11, scoreB: 9 }, // B +2
      { teamA: 3, teamB: 1, scoreA: 11, scoreB: 9 }, // C +2
    ]
    const standings = computeStandings([1, 2, 3], results, ['headToHead', 'pointDiff'])
    // PDs: team1 = +8-2 = +6, team2 = -8+2 = -6, team3 = -2+2 = 0
    expect(standings.map((s) => s.teamId)).toEqual([1, 3, 2])
  })

  it('ranks fewer points against higher when that rule leads', () => {
    // Teams 1 and 2 are both 1-0; team 2 conceded 2 points, team 1 conceded 9.
    const results = [
      { teamA: 1, teamB: 3, scoreA: 11, scoreB: 9 },
      { teamA: 2, teamB: 4, scoreA: 11, scoreB: 2 },
    ]
    const standings = computeStandings([1, 2, 3, 4], results, ['pointsAgainst'])
    expect(standings.map((s) => s.teamId)).toEqual([2, 1, 3, 4])
  })
})

describe('winnerOf', () => {
  it('names the side with more points', () => {
    expect(winnerOf(11, 7)).toBe('A')
    expect(winnerOf(7, 11)).toBe('B')
  })
  it('is null for a tie', () => {
    expect(winnerOf(0, 0)).toBeNull()
    expect(winnerOf(5, 5)).toBeNull()
  })
})
