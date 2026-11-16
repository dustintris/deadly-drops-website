import { describe, expect, it } from 'vitest'
import {
  balancedGamesPerTeam,
  generateExtendedRoundRobin,
  planRoundRobin,
  type Pairing,
} from './extendedRoundRobin'

function ids(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i + 1)
}

function gamesPerTeam(rounds: Pairing[][], n: number): number[] {
  const count = new Array<number>(n).fill(0)
  for (const round of rounds) {
    for (const [a, b] of round) {
      count[a - 1]++
      count[b - 1]++
    }
  }
  return count
}

function pairKey(a: number, b: number): string {
  return `${Math.min(a, b)}-${Math.max(a, b)}`
}

/** Times each pairing meets, over the whole schedule. */
function meetings(rounds: Pairing[][]): Map<string, number> {
  const m = new Map<string, number>()
  for (const round of rounds) {
    for (const [a, b] of round) m.set(pairKey(a, b), (m.get(pairKey(a, b)) ?? 0) + 1)
  }
  return m
}

function expectNoTeamTwiceInARound(rounds: Pairing[][]) {
  for (const round of rounds) {
    const seen = new Set<number>()
    for (const [a, b] of round) {
      expect(seen.has(a)).toBe(false)
      expect(seen.has(b)).toBe(false)
      seen.add(a)
      seen.add(b)
    }
  }
}

describe('balancedGamesPerTeam', () => {
  it('is a full round robin when the target is already met', () => {
    expect(balancedGamesPerTeam(8, 7)).toBe(7)
    expect(balancedGamesPerTeam(10, 7)).toBe(9)
  })

  it('adds the extra games when they divide evenly', () => {
    expect(balancedGamesPerTeam(6, 7)).toBe(7)
    expect(balancedGamesPerTeam(4, 7)).toBe(7)
    expect(balancedGamesPerTeam(2, 7)).toBe(7)
  })

  it('drops one game, never adds one, when they cannot be shared evenly', () => {
    // 7 teams x 1 extra game is 3.5 games.
    expect(balancedGamesPerTeam(7, 7)).toBe(6)
    // 5 teams x 3 extra is 7.5 games; 2 extra each is 5 games.
    expect(balancedGamesPerTeam(5, 7)).toBe(6)
    expect(balancedGamesPerTeam(3, 7)).toBe(6)
  })

  it('is zero for fewer than two teams', () => {
    expect(balancedGamesPerTeam(1, 7)).toBe(0)
    expect(balancedGamesPerTeam(0, 7)).toBe(0)
  })
})

describe('generateExtendedRoundRobin', () => {
  it('leaves a full 8-team division untouched: 7 rounds, every pair once', () => {
    const rounds = generateExtendedRoundRobin(ids(8), 7)
    expect(rounds).toHaveLength(7)
    expect(gamesPerTeam(rounds, 8)).toEqual(new Array(8).fill(7))
    expect([...meetings(rounds).values()].every((v) => v === 1)).toBe(true)
  })

  it('gives 6 teams 7 games in 7 rounds on 3 courts, two rematches each', () => {
    const rounds = generateExtendedRoundRobin(ids(6), 7)
    expect(rounds).toHaveLength(7)
    expect(rounds.every((r) => r.length === 3)).toBe(true)
    expect(gamesPerTeam(rounds, 6)).toEqual(new Array(6).fill(7))
    expectNoTeamTwiceInARound(rounds)

    // Everyone still plays everyone, and each team has exactly 2 rematches,
    // against 2 different opponents.
    const met = meetings(rounds)
    expect(met.size).toBe(15)
    for (let t = 1; t <= 6; t++) {
      const rematches = ids(6).filter((o) => o !== t && met.get(pairKey(t, o)) === 2)
      expect(rematches).toHaveLength(2)
    }
    // Rematches come after the round robin, not interleaved with it.
    expect(rounds.slice(5)).toEqual(rounds.slice(0, 2))
  })

  it('gives 7 teams 6 games in 7 rounds and no rematches', () => {
    const rounds = generateExtendedRoundRobin(ids(7), 7)
    expect(rounds).toHaveLength(7)
    expect(gamesPerTeam(rounds, 7)).toEqual(new Array(7).fill(6))
    expect(meetings(rounds).size).toBe(21)
  })

  it('gives 5 teams 6 games: a round robin plus a balanced rematch cycle', () => {
    const rounds = generateExtendedRoundRobin(ids(5), 7)
    expect(gamesPerTeam(rounds, 5)).toEqual(new Array(5).fill(6))
    expectNoTeamTwiceInARound(rounds)
    expect(rounds.every((r) => r.length <= 2)).toBe(true)
    // 15 games at 2 per round cannot fit in fewer than 8 rounds.
    expect(rounds).toHaveLength(8)
    const met = meetings(rounds)
    expect(met.size).toBe(10)
    expect([...met.values()].filter((v) => v === 2)).toHaveLength(5)
  })

  it('gives 4 teams 7 games in 7 rounds on 2 courts', () => {
    const rounds = generateExtendedRoundRobin(ids(4), 7)
    expect(rounds).toHaveLength(7)
    expect(rounds.every((r) => r.length === 2)).toBe(true)
    expect(gamesPerTeam(rounds, 4)).toEqual(new Array(4).fill(7))
    expectNoTeamTwiceInARound(rounds)
  })

  it('gives 3 teams 6 games: three round robins', () => {
    const rounds = generateExtendedRoundRobin(ids(3), 7)
    expect(rounds).toHaveLength(9)
    expect(gamesPerTeam(rounds, 3)).toEqual([6, 6, 6])
    expect([...meetings(rounds).values()]).toEqual([3, 3, 3])
  })

  it('stays balanced for every team count a division can have', () => {
    for (let n = 2; n <= 12; n++) {
      for (let target = 1; target <= 12; target++) {
        const rounds = generateExtendedRoundRobin(ids(n), target)
        const expected = balancedGamesPerTeam(n, target)
        expect(gamesPerTeam(rounds, n), `${n} teams, ${target} games`).toEqual(
          new Array(n).fill(expected),
        )
        expectNoTeamTwiceInARound(rounds)
        expect(rounds.every((r) => r.length <= Math.floor(n / 2))).toBe(true)
        // Every pairing of the single round robin is present.
        expect(meetings(rounds).size).toBe((n * (n - 1)) / 2)
      }
    }
  })

  it('returns nothing for fewer than two teams', () => {
    expect(generateExtendedRoundRobin([], 7)).toEqual([])
    expect(generateExtendedRoundRobin([1], 7)).toEqual([])
  })
})

describe('planRoundRobin', () => {
  it('summarises rounds, courts and rematch rounds', () => {
    expect(planRoundRobin(8, 7)).toEqual({ gamesEach: 7, rounds: 7, courts: 4, rematchRounds: 0 })
    expect(planRoundRobin(6, 7)).toEqual({ gamesEach: 7, rounds: 7, courts: 3, rematchRounds: 2 })
    expect(planRoundRobin(7, 7)).toEqual({ gamesEach: 6, rounds: 7, courts: 3, rematchRounds: 0 })
    expect(planRoundRobin(5, 7)).toEqual({ gamesEach: 6, rounds: 8, courts: 2, rematchRounds: 3 })
    expect(planRoundRobin(1, 7)).toEqual({ gamesEach: 0, rounds: 0, courts: 0, rematchRounds: 0 })
  })
})
