import { describe, expect, it, vi } from 'vitest'
import type { DivisionPlay, Match, Team, TournamentPlay } from '@/lib/play/repo'
import { divisionChampions } from '../champions'

// only the pure picker is tested here; the loader's data access stays out of it
vi.mock('../data', () => ({}))

let nextId = 1
const done = (a: number, b: number, sa: number, sb: number): Match => ({
  id: nextId++, divisionId: 1, stage: 'pool', round: 1, slot: 0, court: 1, startsAt: '08:00',
  teamAId: a, teamBId: b, scoreA: sa, scoreB: sb, status: 'final', version: 1, updatedBy: null, updatedAt: '2026-06-13T08:00:00Z',
})
const team = (id: number, name: string, players: string[]): Team => ({
  id, divisionId: 1, name, sort: id,
  players: players.map((p, i) => ({ id: id * 10 + i, name: p, dupr: '', checkedInAt: null, checkedInBy: null })),
})
const division = (id: number, name: string, matches: Match[]): DivisionPlay => ({
  id, name, format: 'mixed', dayIndex: 0, startTime: '08:00', gamesTo: 11, gamesPerTeam: 1, winBy2: true,
  playoffs: 'none', bronze: 'standings',
  teams: [team(1, 'Drop Shots', ['Ana Cruz', 'Bo Reyes']), team(2, 'Kitchen Crew', ['Cy Lee', 'Di Moss'])],
  matches,
})
const play = (divisions: DivisionPlay[]): TournamentPlay => ({
  id: 1, slug: 'dominate', name: 'DOMINATE', days: ['2026-06-13'], visible: true, liveVersion: 1,
  rules: { tiebreakers: ['headToHead', 'pointDiff'] } as TournamentPlay['rules'],
  divisions,
})

describe('divisionChampions', () => {
  it("names each division's gold medallist with their players, in division order", () => {
    const champs = divisionChampions(play([division(7, '3.5 Mixed', [done(1, 2, 11, 6)]), division(8, '4.0 Mixed', [done(1, 2, 4, 11)])]))
    expect(champs).toEqual([
      { divisionId: 7, division: '3.5 Mixed', team: 'Drop Shots', players: 'Ana Cruz & Bo Reyes' },
      { divisionId: 8, division: '4.0 Mixed', team: 'Kitchen Crew', players: 'Cy Lee & Di Moss' },
    ])
  })

  it('leaves out a division whose gold is not decided yet, and gives nothing for a tournament without play', () => {
    const unfinished = division(9, '3.0 Mixed', [{ ...done(1, 2, 5, 3), status: 'live' }])
    expect(divisionChampions(play([unfinished]))).toEqual([])
    expect(divisionChampions(play([division(10, '4.5 Mixed', [])]))).toEqual([])
  })
})
