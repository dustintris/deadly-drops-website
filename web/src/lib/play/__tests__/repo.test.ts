import { beforeEach, describe, expect, it } from 'vitest'
import { getSql } from '@/db/client'
import { createTournament, DivisionInUseError, saveTournament, type Tournament } from '@/lib/tournaments/repo'
import { TournamentInput } from '@/lib/tournaments/schema'
import {
  generateSchedule,
  getTournamentPlay,
  GameNotFinishedError,
  saveScore,
  ScheduleExistsError,
  ScoresExistError,
  setCheckedIn,
  setTeams,
  StaleMatchError,
  NotFoundError,
} from '../repo'

const sql = () => getSql()

beforeEach(async () => {
  await sql()`truncate tournaments, divisions, teams, players, matches, app_meta restart identity cascade`
})

const payload = (t: Tournament, divisions: object[]) =>
  TournamentInput.parse({
    name: t.name, slug: t.slug, days: ['2027-05-01'], featured: false, visible: true, info: t.info,
    rules: { ...t.rules, gamesTo: 11, winBy2: true, gamesPerTeam: 3 },
    divisions,
  })

const division = (name = '3.5 Mixed') => ({
  name, format: 'mixed', dayIndex: 0, startTime: '08:00', minutesPerRound: 20, firstCourt: 3, courtCount: 2,
  teamLimit: 8, gamesTo: null, gamesPerTeam: null, playoffs: 'none', bronze: 'standings',
})

async function setup(teamCount = 4) {
  const t = await createTournament('Play Day')
  const saved = await saveTournament(t.id, payload(t, [division()]), t.version)
  const divisionId = saved.divisions[0].id
  await setTeams(divisionId, Array.from({ length: teamCount }, (_, i) => ({
    name: `Team ${i + 1}`, players: [{ name: `P${i}a`, dupr: '3.5' }, { name: `P${i}b`, dupr: '' }],
  })))
  return { tournament: saved, divisionId }
}

const liveVersion = async (id: number) => (await sql()`select live_version::int as v from tournaments where id = ${id}`)[0].v as number

describe('teams', () => {
  it('stores teams and players in order, keeping ids of teams that stay', async () => {
    const { tournament, divisionId } = await setup(3)
    const play = (await getTournamentPlay(tournament.id))!
    const teams = play.divisions[0].teams
    expect(teams.map((x) => x.name)).toEqual(['Team 1', 'Team 2', 'Team 3'])
    expect(teams[0].players.map((p) => p.name)).toEqual(['P0a', 'P0b'])

    await setTeams(divisionId, [{ id: teams[1].id, name: 'Team Two', players: teams[1].players }])
    const again = (await getTournamentPlay(tournament.id))!.divisions[0].teams
    expect(again).toHaveLength(1)
    expect(again[0]).toMatchObject({ id: teams[1].id, name: 'Team Two' })
  })

  it('locks the teams once a schedule exists', async () => {
    const { divisionId } = await setup(4)
    await generateSchedule(divisionId)
    await expect(setTeams(divisionId, [])).rejects.toBeInstanceOf(ScheduleExistsError)
  })
})

describe('schedule', () => {
  it('gives every team the promised number of games on the division’s courts, from its start time', async () => {
    const { tournament, divisionId } = await setup(4)
    const before = await liveVersion(tournament.id)
    await generateSchedule(divisionId)

    const play = (await getTournamentPlay(tournament.id))!
    const matches = play.divisions[0].matches
    const games = new Map<number, number>()
    for (const m of matches) for (const id of [m.teamAId!, m.teamBId!]) games.set(id, (games.get(id) ?? 0) + 1)
    expect([...games.values()].every((n) => n === 3)).toBe(true)
    expect(matches.every((m) => m.court !== null && m.court >= 3 && m.court <= 4 && m.status === 'scheduled')).toBe(true)
    expect(matches[0].startsAt).toBe('08:00')
    expect(await liveVersion(tournament.id)).toBeGreaterThan(before)
  })

  it('won’t redo a schedule once a score is in', async () => {
    const { tournament, divisionId } = await setup(4)
    await generateSchedule(divisionId)
    const m = (await getTournamentPlay(tournament.id))!.divisions[0].matches[0]
    await saveScore({ matchId: m.id, scoreA: 3, scoreB: 1, status: 'live', expectedVersion: m.version, who: 'scorer@x.test' })
    await expect(generateSchedule(divisionId)).rejects.toBeInstanceOf(ScoresExistError)
  })
})

describe('scores', () => {
  it('saves a score, bumps its version and the tournament’s live version, and tells listeners', async () => {
    const { tournament, divisionId } = await setup(4)
    await generateSchedule(divisionId)
    const m = (await getTournamentPlay(tournament.id))!.divisions[0].matches[0]

    const heard: string[] = []
    const listener = await sql().listen('ddp_live', (payload) => heard.push(payload))
    const before = await liveVersion(tournament.id)
    const saved = await saveScore({ matchId: m.id, scoreA: 5, scoreB: 2, status: 'live', expectedVersion: m.version, who: 'scorer@x.test' })
    await new Promise((r) => setTimeout(r, 200))
    await listener.unlisten()

    expect(saved).toMatchObject({ scoreA: 5, scoreB: 2, status: 'live', version: m.version + 1, updatedBy: 'scorer@x.test' })
    expect(await liveVersion(tournament.id)).toBe(before + 1)
    expect(heard.map((p) => JSON.parse(p))).toContainEqual({ t: tournament.id, v: before + 1 })
  })

  it('refuses a score based on an old copy, returning the current one', async () => {
    const { tournament, divisionId } = await setup(4)
    await generateSchedule(divisionId)
    const m = (await getTournamentPlay(tournament.id))!.divisions[0].matches[0]
    await saveScore({ matchId: m.id, scoreA: 4, scoreB: 4, status: 'live', expectedVersion: m.version, who: 'a@x.test' })
    const err = await saveScore({ matchId: m.id, scoreA: 9, scoreB: 0, status: 'live', expectedVersion: m.version, who: 'b@x.test' }).catch((e) => e)
    expect(err).toBeInstanceOf(StaleMatchError)
    expect((err as StaleMatchError).current).toMatchObject({ scoreA: 4, scoreB: 4 })
  })

  it('only lets a finished game be marked final, unless forced (time cap)', async () => {
    const { tournament, divisionId } = await setup(4)
    await generateSchedule(divisionId)
    const m = (await getTournamentPlay(tournament.id))!.divisions[0].matches[0]
    // games to 11, win by 2 (set in the rules above)
    await expect(saveScore({ matchId: m.id, scoreA: 11, scoreB: 10, status: 'final', expectedVersion: m.version, who: 'a@x.test' }))
      .rejects.toBeInstanceOf(GameNotFinishedError)
    const done = await saveScore({ matchId: m.id, scoreA: 12, scoreB: 10, status: 'final', expectedVersion: m.version, who: 'a@x.test' })
    expect(done.status).toBe('final')
    const forced = await saveScore({ matchId: m.id, scoreA: 8, scoreB: 6, status: 'final', expectedVersion: done.version, who: 'a@x.test', force: true })
    expect(forced).toMatchObject({ scoreA: 8, scoreB: 6, status: 'final' })
  })
})

describe('protecting played divisions', () => {
  it('won’t drop a division that has teams when the tournament is saved', async () => {
    const { tournament } = await setup(2)
    const fresh = await getSql()`select version from tournaments where id = ${tournament.id}`
    await expect(saveTournament(tournament.id, payload(tournament, []), fresh[0].version as number)).rejects.toBeInstanceOf(DivisionInUseError)
  })
})

describe('check-in', () => {
  const roster = async (id: number) => (await getTournamentPlay(id))!.divisions[0].teams.flatMap((x) => x.players)

  it('checks players in, records who did it, bumps the live version once and tells listeners', async () => {
    const { tournament } = await setup(2)
    const [p1, p2] = await roster(tournament.id)
    const heard: string[] = []
    const listener = await sql().listen('ddp_live', (payload) => heard.push(payload))
    const before = await liveVersion(tournament.id)

    const out = await setCheckedIn({ tournamentId: tournament.id, playerIds: [p1.id, p2.id], checkedIn: true, who: 'desk@x.test' })
    await new Promise((r) => setTimeout(r, 200))
    await listener.unlisten()

    expect(out.map((p) => p.id).sort()).toEqual([p1.id, p2.id].sort())
    expect(out.every((p) => p.checkedInAt !== null && p.checkedInBy === 'desk@x.test')).toBe(true)
    expect(await liveVersion(tournament.id)).toBe(before + 1)
    expect(heard.map((p) => JSON.parse(p))).toContainEqual({ t: tournament.id, v: before + 1 })
    const after = await roster(tournament.id)
    expect(after.filter((p) => p.checkedInAt).map((p) => p.id).sort()).toEqual([p1.id, p2.id].sort())
  })

  it('keeps the first check-in time when a player is checked in again', async () => {
    const { tournament } = await setup(2)
    const [p1] = await roster(tournament.id)
    const [first] = await setCheckedIn({ tournamentId: tournament.id, playerIds: [p1.id], checkedIn: true, who: 'a@x.test' })
    await new Promise((r) => setTimeout(r, 20))
    const [again] = await setCheckedIn({ tournamentId: tournament.id, playerIds: [p1.id], checkedIn: true, who: 'b@x.test' })
    expect(again.checkedInAt).toBe(first.checkedInAt)
    expect(again.checkedInBy).toBe('a@x.test')
  })

  it('undoes a check-in', async () => {
    const { tournament } = await setup(2)
    const [p1] = await roster(tournament.id)
    await setCheckedIn({ tournamentId: tournament.id, playerIds: [p1.id], checkedIn: true, who: 'a@x.test' })
    const [undone] = await setCheckedIn({ tournamentId: tournament.id, playerIds: [p1.id], checkedIn: false, who: 'a@x.test' })
    expect(undone).toMatchObject({ checkedInAt: null, checkedInBy: null })
  })

  it('refuses a player from another tournament and changes nothing', async () => {
    const one = await setup(2)
    const two = await setup(2)
    const [mine] = await roster(one.tournament.id)
    const [theirs] = await roster(two.tournament.id)
    const before = await liveVersion(one.tournament.id)
    await expect(
      setCheckedIn({ tournamentId: one.tournament.id, playerIds: [mine.id, theirs.id], checkedIn: true, who: 'a@x.test' }),
    ).rejects.toBeInstanceOf(NotFoundError)
    expect((await roster(one.tournament.id)).every((p) => p.checkedInAt === null)).toBe(true)
    expect((await roster(two.tournament.id)).every((p) => p.checkedInAt === null)).toBe(true)
    expect(await liveVersion(one.tournament.id)).toBe(before)
  })

  it('keeps a check-in when the teams are saved again', async () => {
    const { tournament, divisionId } = await setup(2)
    const teams = (await getTournamentPlay(tournament.id))!.divisions[0].teams
    await setCheckedIn({ tournamentId: tournament.id, playerIds: [teams[0].players[0].id], checkedIn: true, who: 'a@x.test' })
    await setTeams(divisionId, teams.map((x) => ({ id: x.id, name: x.name, players: x.players.map((p) => ({ id: p.id, name: p.name, dupr: p.dupr })) })))
    const [p] = await roster(tournament.id)
    expect(p.checkedInAt).not.toBeNull()
  })
})
