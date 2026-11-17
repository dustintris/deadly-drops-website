import { beforeEach, describe, expect, it } from 'vitest'
import { getSql } from '@/db/client'
import { createTournament, PlayoffsDrawnError, saveTournament, type Tournament } from '@/lib/tournaments/repo'
import { TournamentInput } from '@/lib/tournaments/schema'
import {
  BracketStartedError,
  drawPlayoffs,
  generateSchedule,
  getTournamentPlay,
  MatchNotReadyError,
  PlayoffScoresExistError,
  PlayoffsExistError,
  PoolNotFinishedError,
  resetPlayoffs,
  saveScore,
  setTeams,
  TooFewTeamsError,
  type Match,
} from '../repo'

/*
 * Playoffs against a real database: drawn when pool play ends, winners moved on as games finish,
 * and corrections that would change a game already under way refused.
 */

const sql = () => getSql()

beforeEach(async () => {
  await sql()`truncate tournaments, divisions, teams, players, matches, app_meta restart identity cascade`
})

const payload = (t: Tournament, divisions: object[]) =>
  TournamentInput.parse({
    name: t.name, slug: t.slug, days: ['2027-05-01'], featured: false, visible: true, info: t.info,
    // pool games to 11, playoff games to 15, win by 2
    rules: { ...t.rules, gamesTo: 11, playoffGamesTo: 15, winBy2: true, gamesPerTeam: 3 },
    divisions,
  })

const division = (playoffs: string, bronze: string) => ({
  name: '3.5 Mixed', format: 'mixed', dayIndex: 0, startTime: '08:00', minutesPerRound: 20, firstCourt: 1, courtCount: 2,
  teamLimit: 8, gamesTo: null, gamesPerTeam: null, playoffs, bronze,
})

async function setup(teamCount: number, playoffs = 'top4', bronze = 'match') {
  const t = await createTournament('Playoff Day')
  const saved = await saveTournament(t.id, payload(t, [division(playoffs, bronze)]), t.version)
  const divisionId = saved.divisions[0].id
  await setTeams(divisionId, Array.from({ length: teamCount }, (_, i) => ({ name: `Team ${i + 1}`, players: [{ name: `P${i}a`, dupr: '' }] })))
  await generateSchedule(divisionId)
  return { tournament: saved, divisionId }
}

type Div = NonNullable<Awaited<ReturnType<typeof getTournamentPlay>>>['divisions'][number]
const play = async (id: number): Promise<Div> => (await getTournamentPlay(id))!.divisions[0]
const teamNo = (d: Div, id: number | null) => (id === null ? null : d.teams.findIndex((x) => x.id === id) + 1)
const game = (d: Div, stage: Match['stage'], slot = 1) => d.matches.find((m) => m.stage === stage && m.slot === slot)!
const sides = (d: Div, m: Match) => [teamNo(d, m.teamAId), teamNo(d, m.teamBId)]

const finish = (m: Match, scoreA: number, scoreB: number) =>
  saveScore({ matchId: m.id, scoreA, scoreB, status: 'final', expectedVersion: m.version, who: 'scorer@x.test' })

/** Finish every pool game; the lower-numbered team always wins, so the pool order is Team 1, 2, 3… */
async function finishPool(tournamentId: number) {
  const d = await play(tournamentId)
  for (const m of d.matches.filter((x) => x.stage === 'pool')) {
    const aWins = teamNo(d, m.teamAId)! < teamNo(d, m.teamBId)!
    await finish(m, aWins ? 11 : 5, aWins ? 5 : 11)
  }
}

describe('drawing the playoffs', () => {
  it('draws top 4 by itself when the last pool game goes final: 1 v 4, 2 v 3, final and bronze waiting', async () => {
    const { tournament } = await setup(4)
    await finishPool(tournament.id)
    const d = await play(tournament.id)
    expect(sides(d, game(d, 'sf', 1))).toEqual([1, 4])
    expect(sides(d, game(d, 'sf', 2))).toEqual([2, 3])
    expect(game(d, 'final')).toMatchObject({ teamAId: null, teamBId: null, status: 'scheduled', court: 1 })
    expect(game(d, 'bronze')).toMatchObject({ teamAId: null, teamBId: null, court: 2 })
    expect(d.matches.filter((m) => m.stage !== 'pool').every((m) => m.startsAt === null)).toBe(true)
  })

  it('draws top 8 with all eight teams in the quarterfinals', async () => {
    const { tournament } = await setup(8, 'top8', 'standings')
    await finishPool(tournament.id)
    const d = await play(tournament.id)
    const qf = d.matches.filter((m) => m.stage === 'qf')
    expect(qf).toHaveLength(4)
    expect(new Set(qf.flatMap((m) => [m.teamAId, m.teamBId])).size).toBe(8)
    expect(d.matches.some((m) => m.stage === 'bronze')).toBe(false)
  })

  it('waits for enough teams, and says why when drawn by hand', async () => {
    const { tournament, divisionId } = await setup(4, 'top8')
    await finishPool(tournament.id)
    expect((await play(tournament.id)).matches.every((m) => m.stage === 'pool')).toBe(true)
    await expect(drawPlayoffs(divisionId)).rejects.toBeInstanceOf(TooFewTeamsError)
  })

  it('won’t draw by hand before pool play ends, or twice', async () => {
    const { tournament, divisionId } = await setup(4)
    await expect(drawPlayoffs(divisionId)).rejects.toBeInstanceOf(PoolNotFinishedError)
    await finishPool(tournament.id)
    await expect(drawPlayoffs(divisionId)).rejects.toBeInstanceOf(PlayoffsExistError)
  })

  it('re-seeds when a pool score is corrected before the playoffs start', async () => {
    const { tournament } = await setup(4)
    await finishPool(tournament.id)
    let d = await play(tournament.id)
    // Team 3 now beats Team 2, so Team 3 finishes second (2 wins) and Team 2 third
    const m = d.matches.find((x) => x.stage === 'pool' && sides(d, x).sort().join() === '2,3')!
    const twoIsA = teamNo(d, m.teamAId) === 2
    await finish(m, twoIsA ? 5 : 11, twoIsA ? 11 : 5)
    d = await play(tournament.id)
    expect(sides(d, game(d, 'sf', 2))).toEqual([3, 2])
  })
})

describe('moving teams on', () => {
  it('sends the winners to the final and the losers to the bronze match', async () => {
    const { tournament } = await setup(4)
    await finishPool(tournament.id)
    let d = await play(tournament.id)
    await finish(game(d, 'sf', 1), 15, 9) // Team 1 beats Team 4
    await finish(game(d, 'sf', 2), 10, 15) // Team 3 beats Team 2
    d = await play(tournament.id)
    expect(sides(d, game(d, 'final'))).toEqual([1, 3])
    expect(sides(d, game(d, 'bronze'))).toEqual([4, 2])
  })

  it('plays playoff games to the playoff target', async () => {
    const { tournament } = await setup(4)
    await finishPool(tournament.id)
    const d = await play(tournament.id)
    await expect(finish(game(d, 'sf', 1), 11, 5)).rejects.toThrow(/played to 15/)
  })

  it('won’t score a game whose teams aren’t known yet', async () => {
    const { tournament } = await setup(4)
    await finishPool(tournament.id)
    const d = await play(tournament.id)
    await expect(finish(game(d, 'final'), 15, 3)).rejects.toBeInstanceOf(MatchNotReadyError)
  })

  it('empties the next game again when a result is reopened before that game starts', async () => {
    const { tournament } = await setup(4)
    await finishPool(tournament.id)
    let d = await play(tournament.id)
    const sf1 = await finish(game(d, 'sf', 1), 15, 9)
    d = await play(tournament.id)
    expect(game(d, 'final').teamAId).not.toBeNull()
    await saveScore({ matchId: sf1.id, scoreA: 14, scoreB: 9, status: 'live', expectedVersion: sf1.version, who: 'scorer@x.test' })
    d = await play(tournament.id)
    expect(game(d, 'final').teamAId).toBeNull()
  })

  it('refuses a correction that would change a game already under way, and keeps the old result', async () => {
    const { tournament } = await setup(4)
    await finishPool(tournament.id)
    let d = await play(tournament.id)
    const sf1 = await finish(game(d, 'sf', 1), 15, 9)
    await finish(game(d, 'sf', 2), 15, 10)
    d = await play(tournament.id)
    const final = game(d, 'final')
    await saveScore({ matchId: final.id, scoreA: 3, scoreB: 2, status: 'live', expectedVersion: final.version, who: 'scorer@x.test' })

    await expect(finish(sf1, 9, 15)).rejects.toBeInstanceOf(BracketStartedError)
    d = await play(tournament.id)
    expect(game(d, 'sf', 1)).toMatchObject({ scoreA: 15, scoreB: 9 })
  })

  it('refuses reopening the pool once the playoffs have started', async () => {
    const { tournament } = await setup(4)
    await finishPool(tournament.id)
    let d = await play(tournament.id)
    await saveScore({ matchId: game(d, 'sf', 1).id, scoreA: 2, scoreB: 0, status: 'live', expectedVersion: game(d, 'sf', 1).version, who: 'a@x.test' })
    d = await play(tournament.id)
    const pool = d.matches.find((m) => m.stage === 'pool')!
    await expect(saveScore({ matchId: pool.id, scoreA: 11, scoreB: 5, status: 'live', expectedVersion: pool.version, who: 'a@x.test' }))
      .rejects.toBeInstanceOf(BracketStartedError)
  })
})

describe('a drawn bracket stands', () => {
  /** Score the pool so the order depends on the tiebreakers: 1, 2 and 3 beat each other in a circle. */
  async function circularPool(tournamentId: number) {
    const d = await play(tournamentId)
    const wins: Record<string, [number, number, number]> = {
      // winner, its score, the loser's score
      '1,2': [1, 11, 9], '1,4': [1, 11, 3], '2,3': [2, 11, 9], '2,4': [2, 11, 0], '1,3': [3, 11, 9], '3,4': [3, 11, 5],
    }
    for (const m of d.matches.filter((x) => x.stage === 'pool')) {
      const [a, b] = sides(d, m) as [number, number]
      const [winner, w, l] = wins[[a, b].sort().join()]
      await finish(m, winner === a ? w : l, winner === a ? l : w)
    }
  }

  it('scores the playoffs even after the tiebreakers are changed (a playoff result never re-seeds)', async () => {
    const { tournament } = await setup(4)
    await circularPool(tournament.id)
    let d = await play(tournament.id)
    // all on 2 wins bar Team 4; point difference puts Team 2 (+11) ahead of Team 1 (+8) and Team 3 (+6)
    expect(sides(d, game(d, 'sf', 1))).toEqual([2, 4])

    // with "most points for" alone, 1, 2 and 3 are level (31 each), so the order would now be 1, 2, 3
    const [{ version }] = await sql()`select version from tournaments where id = ${tournament.id}`
    const again = payload(tournament, [{ ...division('top4', 'match'), id: d.id }])
    await saveTournament(tournament.id, { ...again, rules: { ...again.rules, tiebreakers: ['pointsFor'] } }, version as number)

    await saveScore({ matchId: game(d, 'sf', 2).id, scoreA: 3, scoreB: 1, status: 'live', expectedVersion: game(d, 'sf', 2).version, who: 'a@x.test' })
    d = await play(tournament.id)
    await finish(game(d, 'sf', 1), 15, 7)
    d = await play(tournament.id)
    expect(sides(d, game(d, 'sf', 1))).toEqual([2, 4])
    expect(teamNo(d, game(d, 'final').teamAId)).toBe(2)
  })

  it('top 8: reopening a quarterfinal empties its place in the semifinal again', async () => {
    const { tournament } = await setup(8, 'top8', 'standings')
    await finishPool(tournament.id)
    let d = await play(tournament.id)
    const qf1 = await finish(game(d, 'qf', 1), 15, 4)
    d = await play(tournament.id)
    expect(game(d, 'sf', 1).teamAId).toBe(qf1.teamAId)
    await saveScore({ matchId: qf1.id, scoreA: 14, scoreB: 4, status: 'live', expectedVersion: qf1.version, who: 'a@x.test' })
    d = await play(tournament.id)
    expect(game(d, 'sf', 1).teamAId).toBeNull()
  })
})

describe('resetting', () => {
  it('removes unplayed playoff games so they can be drawn again', async () => {
    const { tournament, divisionId } = await setup(4)
    await finishPool(tournament.id)
    await resetPlayoffs(divisionId)
    expect((await play(tournament.id)).matches.every((m) => m.stage === 'pool')).toBe(true)
    expect(await drawPlayoffs(divisionId)).toBe(4)
  })

  it('refuses once a playoff game has a score', async () => {
    const { tournament, divisionId } = await setup(4)
    await finishPool(tournament.id)
    const d = await play(tournament.id)
    await saveScore({ matchId: game(d, 'sf', 1).id, scoreA: 1, scoreB: 0, status: 'live', expectedVersion: game(d, 'sf', 1).version, who: 'a@x.test' })
    await expect(resetPlayoffs(divisionId)).rejects.toBeInstanceOf(PlayoffScoresExistError)
  })

  it('stops the playoff format changing under a drawn bracket', async () => {
    const { tournament } = await setup(4)
    await finishPool(tournament.id)
    const [{ version }] = await sql()`select version from tournaments where id = ${tournament.id}`
    const d = await play(tournament.id)
    const changed = payload(tournament, [{ ...division('top4', 'standings'), id: d.id }])
    await expect(saveTournament(tournament.id, changed, version as number)).rejects.toBeInstanceOf(PlayoffsDrawnError)
  })
})
