import { describe, expect, it } from 'vitest'
import { divisionBoard } from './board'

const teams = [
  { id: 1, name: 'Ninjas' },
  { id: 2, name: 'Dinkers' },
  { id: 3, name: 'Smash' },
]
type M = Parameters<typeof divisionBoard>[0]['matches'][number]
const m = (
  round: number,
  a: number | null,
  b: number | null,
  sa: number | null,
  sb: number | null,
  status: M['status'],
): M => ({ round, teamA: a, teamB: b, scoreA: sa, scoreB: sb, status })
const tb = ['pointDiff' as const]

describe('divisionBoard', () => {
  it('is SETUP with no matches', () => {
    const b = divisionBoard({ teams, matches: [], tiebreakers: tb })
    expect(b.state).toBe('setup')
    expect(b.label).toBe('SETUP')
    expect(b.liveRound).toBeNull()
    expect(b.standings.map((s) => s.name)).toEqual(['Ninjas', 'Dinkers', 'Smash'])
  })

  it('is SETUP while nothing has started', () => {
    const b = divisionBoard({
      teams,
      matches: [m(1, 1, 2, null, null, 'scheduled')],
      tiebreakers: tb,
    })
    expect(b.state).toBe('setup')
    expect(b.label).toBe('SETUP')
  })

  it('is LIVE with the lowest unfinished round', () => {
    const b = divisionBoard({
      teams,
      matches: [
        m(1, 1, 2, 11, 5, 'final'),
        m(2, 2, 3, 3, 2, 'live'),
        m(3, 1, 3, null, null, 'scheduled'),
      ],
      tiebreakers: tb,
    })
    expect(b.state).toBe('live')
    expect(b.liveRound).toBe(2)
    expect(b.label).toBe('LIVE · RD 2')
  })

  it('is LIVE when some matches are final and the rest scheduled', () => {
    const b = divisionBoard({
      teams,
      matches: [m(1, 1, 2, 11, 5, 'final'), m(2, 2, 3, null, null, 'scheduled')],
      tiebreakers: tb,
    })
    expect(b.state).toBe('live')
    expect(b.liveRound).toBe(2)
  })

  it('is FINAL when all are final', () => {
    const b = divisionBoard({
      teams,
      matches: [m(1, 1, 2, 11, 5, 'final'), m(2, 2, 3, 11, 9, 'final')],
      tiebreakers: tb,
    })
    expect(b.state).toBe('final')
    expect(b.label).toBe('FINAL')
    expect(b.liveRound).toBeNull()
  })

  it('only counts final matches in standings, with names attached', () => {
    const b = divisionBoard({
      teams,
      matches: [m(1, 1, 2, 11, 5, 'final'), m(2, 2, 3, 10, 0, 'live')],
      tiebreakers: tb,
    })
    expect(b.standings[0]).toMatchObject({ teamId: 1, name: 'Ninjas', wins: 1, rank: 1 })
    expect(b.standings.find((s) => s.teamId === 3)!.gamesPlayed).toBe(0)
    expect(b.standings.find((s) => s.teamId === 2)!.gamesPlayed).toBe(1)
  })

  it('ignores final matches with missing teams or scores', () => {
    const b = divisionBoard({
      teams,
      matches: [m(1, 1, null, 11, 0, 'final'), m(1, 2, 3, null, null, 'final')],
      tiebreakers: tb,
    })
    expect(b.standings.every((s) => s.gamesPlayed === 0)).toBe(true)
  })
})
