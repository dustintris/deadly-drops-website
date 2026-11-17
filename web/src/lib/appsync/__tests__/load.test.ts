import { beforeEach, describe, expect, it } from 'vitest'
import { getSql } from '@/db/client'
import { setTeams } from '@/lib/play/repo'
import { createTournament, saveTournament } from '@/lib/tournaments/repo'
import { TournamentInput } from '@/lib/tournaments/schema'
import { loadAllForApp, loadForApp } from '../load'

beforeEach(async () => {
  await getSql()`truncate tournaments, divisions, teams, players, matches restart identity cascade`
})

const division = (name: string, firstCourt: number) => ({
  name, format: 'mixed', dayIndex: 0, startTime: '08:00', minutesPerRound: 20, firstCourt, courtCount: 2,
  teamLimit: null, gamesTo: null, gamesPerTeam: null, playoffs: 'none', bronze: 'standings',
})

async function make(name: string) {
  const t = await createTournament(name)
  const saved = await saveTournament(t.id, TournamentInput.parse({
    name, slug: t.slug, days: ['2027-05-01'], featured: false, visible: false, info: t.info, rules: t.rules,
    divisions: [division('Div A', 1), division('Div B', 3)],
  }), t.version)
  await setTeams(saved.divisions[0].id, [
    { name: 'One', players: [{ name: 'P1', dupr: '3.5' }, { name: 'P2', dupr: '' }] },
    { name: 'Two', players: [{ name: 'P3', dupr: '' }, { name: 'P4', dupr: '4.0' }] },
  ])
  await setTeams(saved.divisions[1].id, [{ name: 'Three', players: [{ name: 'P5', dupr: '' }, { name: 'P6', dupr: '' }] }])
  return saved
}

describe('loading tournaments for the desktop app', () => {
  it('puts each tournament’s teams and players under the right division, hidden ones included', async () => {
    const a = await make('Alpha')
    await make('Beta')
    const all = await loadAllForApp()
    expect(all.map((t) => t.name)).toEqual(expect.arrayContaining(['Alpha', 'Beta']))
    const one = (await loadForApp(a.id))!
    expect(one.divisions.map((d) => d.teams.map((x) => x.name))).toEqual([['One', 'Two'], ['Three']])
    expect(one.divisions[0].teams[1].players).toEqual([{ name: 'P3', dupr: '' }, { name: 'P4', dupr: '4.0' }])
    expect(await loadForApp(999)).toBeNull()
  })
})
