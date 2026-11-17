import { describe, expect, it } from 'vitest'
import { skippedTeams, toImportFormat, toSummary, type ExportTournament } from './export'

const player = (name: string, dupr = '') => ({ name, dupr })
const t: ExportTournament = {
  id: 7,
  name: 'Fall Smash',
  days: ['2027-05-01', '2027-05-02'],
  divisions: [
    {
      id: 21, name: '4.0 Open', format: 'open', sort: 1, teamLimit: null, firstCourt: 5, courtCount: 4,
      teams: [{ name: 'Solo', players: [player('Only One')] }, { name: 'Big', players: [player('A', '4.1'), player('B'), player('C')] }],
    },
    {
      id: 20, name: '3.5 Mixed', format: 'mixed', sort: 0, teamLimit: 8, firstCourt: 1, courtCount: 2,
      teams: [{ name: 'Drop Shots', players: [player('José', '3.47'), player('Ana')] }],
    },
  ],
}

describe('toImportFormat (the desktop app’s download format)', () => {
  const out = toImportFormat(t) as {
    name: string; date: string; courts: number
    divisions: { name: string; format: string; teamLimit: number | null; externalId: string; teams: { name: string; players: { name: string; dupr: string }[] }[] }[]
  }

  it('carries the name, first day and the highest court in use', () => {
    expect(out.name).toBe('Fall Smash')
    expect(out.date).toBe('2027-05-01')
    expect(out.courts).toBe(8)
  })

  it('lists divisions in order, with formats the app knows and their own ids', () => {
    expect(out.divisions.map((d) => d.name)).toEqual(['3.5 Mixed', '4.0 Open'])
    expect(out.divisions.map((d) => d.format)).toEqual(['mixed', 'mixed'])
    expect(out.divisions[0]).toMatchObject({ teamLimit: 8, externalId: '20' })
  })

  it('sends exactly two players per team and leaves out teams with only one', () => {
    expect(out.divisions[1].teams.map((x) => x.name)).toEqual(['Big'])
    expect(out.divisions[1].teams[0].players).toEqual([
      { name: 'A', dupr: '4.1', shirtSize: '', meal: '' },
      { name: 'B', dupr: '', shirtSize: '', meal: '' },
    ])
    expect(out.divisions.every((d) => d.teams.every((x) => x.players.length === 2))).toBe(true)
  })

  it('keeps courts between 1 and 12 and the date empty when there are no days', () => {
    const none = toImportFormat({ ...t, days: [], divisions: [] }) as { date: string; courts: number }
    expect(none).toMatchObject({ date: '', courts: 1 })
    const many = toImportFormat({ ...t, divisions: [{ ...t.divisions[0], firstCourt: 10, courtCount: 9 }] }) as { courts: number }
    expect(many.courts).toBe(12)
  })
})

describe('toSummary and skippedTeams', () => {
  it('counts the teams the app will get, and names the ones it won’t', () => {
    expect(toSummary(t)).toEqual({ id: '7', name: 'Fall Smash', date: '2027-05-01', divisions: 2, teams: 2, waitlisted: 0, skipped: 1 })
    expect(skippedTeams(t)).toEqual([{ division: '4.0 Open', team: 'Solo' }])
  })
})
