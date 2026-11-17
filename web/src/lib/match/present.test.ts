import { describe, expect, it } from 'vitest'
import type { DivisionPlay, Match } from '@/lib/play/repo'
import { divisionStatus, matchGroups, medals, playerLine, signed } from './present'
import { courtBoard } from './courts'
import type { Tiebreaker } from './types'

let nextId = 1
const match = (over: Partial<Match>): Match => ({
  id: nextId++, divisionId: 1, stage: 'pool', round: 1, slot: 0, court: 1, startsAt: '08:00',
  teamAId: 1, teamBId: 2, scoreA: null, scoreB: null, status: 'scheduled', version: 1, updatedBy: null, updatedAt: '2027-05-01T08:00:00Z',
  ...over,
})
const team = (id: number) => ({ id, divisionId: 1, name: `Team ${id}`, sort: id, players: [] })
const division = (matches: Match[], over: Partial<DivisionPlay> = {}): DivisionPlay => ({
  id: 1, name: '3.5 Mixed', format: 'mixed', dayIndex: 0, startTime: '08:00', gamesTo: 11, gamesPerTeam: 3, winBy2: true,
  playoffs: 'top4', bronze: 'standings', teams: [team(1), team(2), team(3), team(4)], matches, ...over,
})

describe('present helpers', () => {
  it('formats signed point differences and player lines', () => {
    expect(signed(3)).toBe('+3')
    expect(signed(-2)).toBe('−2')
    expect(signed(0)).toBe('0')
    expect(playerLine(['Ana', 'Bo'])).toBe('Ana & Bo')
    expect(playerLine(['Ana', 'Bo', 'Cy'])).toBe('Ana, Bo, Cy')
  })

  it('groups matches in playing order: pool rounds, then quarterfinals, semifinals, bronze and final', () => {
    const ms = [
      match({ stage: 'final', round: 1 }),
      match({ stage: 'bronze', round: 1 }),
      match({ round: 2, slot: 1, court: 2 }),
      match({ round: 2, slot: 0, court: 1 }),
      match({ stage: 'sf', round: 1 }),
      match({ round: 1 }),
    ]
    const groups = matchGroups(ms)
    expect(groups.map((g) => g.label)).toEqual(['Round 1', 'Round 2', 'Semifinals', 'Bronze match', 'Final'])
    expect(groups[1].matches.map((m) => m.slot)).toEqual([0, 1])
  })
})

describe('divisionStatus', () => {
  const tb: Tiebreaker[] = ['headToHead', 'pointDiff']

  it('is setup before any match exists, showing the start time', () => {
    const s = divisionStatus(division([]), tb)
    expect(s.state).toBe('setup')
    expect(s.status).toBe('Starts 8:00 AM')
    expect(s.ranked).toBe(false)
  })

  it('shows the live pool round', () => {
    const s = divisionStatus(division([match({ round: 1, status: 'final', scoreA: 11, scoreB: 4 }), match({ round: 2, status: 'live', scoreA: 3, scoreB: 1 })]), tb)
    expect(s.state).toBe('live')
    expect(s.status).toBe('Live · Round 2')
    expect(s.ranked).toBe(true)
  })

  it('shows playoffs once the pool is done, and standings ignore playoff games', () => {
    const pool = [match({ teamAId: 1, teamBId: 2, status: 'final', scoreA: 11, scoreB: 2 })]
    const playoff = match({ stage: 'final', teamAId: 2, teamBId: 1, status: 'live', scoreA: 9, scoreB: 0 })
    const s = divisionStatus(division([...pool, playoff]), tb)
    expect(s.status).toBe('Live · Playoffs')
    const one = s.board.standings.find((x) => x.teamId === 1)!
    expect(one.wins).toBe(1)
    expect(one.losses).toBe(0)
  })

  it('is final when every match is final', () => {
    const s = divisionStatus(division([match({ status: 'final', scoreA: 11, scoreB: 9 })]), tb)
    expect(s.state).toBe('final')
    expect(s.status).toBe('Final')
  })
})

describe('courtBoard', () => {
  it('shows each court’s live match and the next one up, skipping matches with no court', () => {
    const d = division([
      match({ court: 1, startsAt: '08:00', status: 'final', scoreA: 11, scoreB: 3 }),
      match({ court: 1, startsAt: '08:20', status: 'live', scoreA: 4, scoreB: 4 }),
      match({ court: 1, startsAt: '08:40' }),
      match({ court: 2, startsAt: '09:00', round: 3 }),
      match({ court: 2, startsAt: '08:40', round: 2 }),
      match({ court: null, startsAt: null, stage: 'final' }),
    ])
    const board = courtBoard([d])
    expect(board.map((c) => c.court)).toEqual([1, 2])
    expect(board[0].now?.startsAt).toBe('08:20')
    expect(board[0].next?.startsAt).toBe('08:40')
    expect(board[1].now).toBeNull()
    expect(board[1].next?.startsAt).toBe('08:40')
    expect(board[0].division).toBe('3.5 Mixed')
  })

  it('still lists a playoff match whose teams are not decided yet', () => {
    const board = courtBoard([division([match({ court: 5, stage: 'sf', teamAId: null, teamBId: null, startsAt: '11:00' })])])
    expect(board).toHaveLength(1)
    expect(board[0].next?.stage).toBe('sf')
  })

  it('leaves out courts with nothing left to play', () => {
    expect(courtBoard([division([match({ court: 1, status: 'final', scoreA: 11, scoreB: 0 })])])).toEqual([])
  })
})

describe('medals', () => {
  const tb: Tiebreaker[] = ['headToHead', 'pointDiff']
  const done = (a: number, b: number, sa: number, sb: number) => match({ teamAId: a, teamBId: b, status: 'final', scoreA: sa, scoreB: sb })

  it('gives none while a game is still to play', () => {
    expect(medals(division([done(1, 2, 11, 3), match({ teamAId: 3, teamBId: 4, status: 'live', scoreA: 4, scoreB: 2 })]), tb)).toEqual([])
    expect(medals(division([]), tb)).toEqual([])
  })

  it('gives gold, silver and bronze to the top 3 once every game is final', () => {
    const d = division([done(1, 2, 11, 3), done(3, 4, 11, 9), done(1, 3, 11, 5), done(2, 4, 11, 1)])
    expect(medals(d, tb)).toEqual([
      { place: 'gold', teamId: 1 },
      { place: 'silver', teamId: 2 },
      { place: 'bronze', teamId: 3 },
    ])
  })

  it('gives only gold and silver with two teams', () => {
    const d = division([done(1, 2, 9, 11)], { teams: [team(1), team(2)] })
    expect(medals(d, tb)).toEqual([{ place: 'gold', teamId: 2 }, { place: 'silver', teamId: 1 }])
  })
})
