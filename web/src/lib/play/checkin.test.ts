import { describe, expect, it } from 'vitest'
import { filterRoster, rosterCounts, type RosterDivision } from './checkin'

const divs: RosterDivision[] = [
  {
    id: 1, name: '3.5 Mixed', dayIndex: 0,
    teams: [
      { id: 10, name: 'Drop Shots', players: [{ id: 100, name: 'José Ramírez', checkedInAt: '2027-05-01T07:50:00Z' }, { id: 101, name: 'Ana Lee', checkedInAt: null }] },
      { id: 11, name: 'Kitchen Crew', players: [{ id: 110, name: 'Bo Chen', checkedInAt: '2027-05-01T07:40:00Z' }, { id: 111, name: 'Cy Diaz', checkedInAt: '2027-05-01T07:41:00Z' }] },
    ],
  },
  {
    id: 2, name: '4.0 Men', dayIndex: 0,
    teams: [{ id: 20, name: 'Smash Bros', players: [{ id: 200, name: 'Dan Ortiz', checkedInAt: null }] }],
  },
]

describe('filterRoster', () => {
  it('finds a player ignoring case and accents, showing just that player’s team', () => {
    const out = filterRoster(divs, { q: 'jose' })
    expect(out).toHaveLength(1)
    expect(out[0].teams.map((t) => t.id)).toEqual([10])
    expect(out[0].teams[0].players.map((p) => p.id)).toEqual([100, 101])
  })

  it('a team-name match shows the whole team', () => {
    const out = filterRoster(divs, { q: 'KITCHEN' })
    expect(out[0].teams[0].players).toHaveLength(2)
  })

  it('filters by division and to teams with someone still missing', () => {
    expect(filterRoster(divs, { divisionId: 2 }).map((d) => d.id)).toEqual([2])
    const missing = filterRoster(divs, { onlyMissing: true })
    expect(missing.flatMap((d) => d.teams.map((t) => t.id))).toEqual([10, 20])
  })

  it('returns everything for an empty search', () => {
    expect(filterRoster(divs, { q: '  ' })).toEqual(divs)
  })
})

describe('rosterCounts', () => {
  it('counts checked-in players and complete teams', () => {
    expect(rosterCounts(divs)).toEqual({ players: 5, checkedIn: 3, teams: 3, teamsComplete: 1 })
  })
})
