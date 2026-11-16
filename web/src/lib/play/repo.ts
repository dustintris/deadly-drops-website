import 'server-only'
import { and, asc, eq, inArray, ne, notInArray, or, sql } from 'drizzle-orm'
import { getDb, type Db } from '@/db/client'
import { divisions, matches, players, teams, tournaments } from '@/db/schema'
import { scheduleDivision } from '@/lib/match/schedule'
import { isGameComplete } from '@/lib/match/scoring'
import type { DivisionFormat, RulesT } from '@/lib/tournaments/schema'

/**
 * Tournament play (Pickle Match): teams, the round-robin schedule and scores. Every change bumps
 * the tournament's live_version and announces it on the `ddp_live` channel in the same transaction
 * (delivered on commit), so every open screen refreshes within a second.
 */

export type MatchStatus = 'scheduled' | 'live' | 'final'
export type Stage = 'pool' | 'qf' | 'sf' | 'final' | 'bronze'
export type Player = { id: number; name: string; dupr: string; checkedInAt: string | null }
export type Team = { id: number; divisionId: number; name: string; sort: number; players: Player[] }
export type Match = {
  id: number
  divisionId: number
  stage: Stage
  round: number
  slot: number
  court: number | null
  startsAt: string | null
  teamAId: number | null
  teamBId: number | null
  scoreA: number | null
  scoreB: number | null
  status: MatchStatus
  version: number
  updatedBy: string | null
  updatedAt: string
}
export type DivisionPlay = {
  id: number
  name: string
  format: DivisionFormat
  dayIndex: number
  startTime: string
  /** effective rules for this division (its overrides, else the tournament's) */
  gamesTo: number
  gamesPerTeam: number
  winBy2: boolean
  playoffs: 'none' | 'top4' | 'top8'
  bronze: 'standings' | 'match'
  teams: Team[]
  matches: Match[]
}
export type TournamentPlay = {
  id: number
  slug: string
  name: string
  days: string[]
  visible: boolean
  liveVersion: number
  rules: RulesT
  divisions: DivisionPlay[]
}
export type TeamInput = { id?: number; name: string; players: { id?: number; name: string; dupr: string }[] }

export class ScheduleExistsError extends Error {
  constructor() { super('This division already has a schedule. Clear the schedule before changing its teams.') }
}
export class ScoresExistError extends Error {
  constructor() { super('Scores are already in for this division, so its schedule can’t be redone.') }
}
export class NotEnoughTeamsError extends Error {
  constructor() { super('Add at least two teams before making a schedule.') }
}
export class GameNotFinishedError extends Error {
  constructor(gamesTo: number, winBy2: boolean) {
    super(`That game isn’t finished: it’s played to ${gamesTo}${winBy2 ? ', win by 2' : ''}. Use “Time cap” to end it early.`)
  }
}
export class TiedGameError extends Error {
  constructor() { super('A game can’t end in a tie.') }
}
export class MatchNotReadyError extends Error {
  constructor() { super('Both teams for this match aren’t known yet.') }
}
export class NotFoundError extends Error {
  constructor(what: string) { super(`That ${what} no longer exists.`) }
}
export class StaleMatchError extends Error {
  constructor(readonly current: Match) {
    super('Someone else just updated this score. The current score is shown; check it and save again.')
  }
}

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]
type Executor = Db | Tx
type MatchRow = typeof matches.$inferSelect

const toMatch = (r: MatchRow): Match => ({
  id: r.id,
  divisionId: r.divisionId,
  stage: r.stage as Stage,
  round: r.round,
  slot: r.slot,
  court: r.court,
  startsAt: r.startsAt,
  teamAId: r.teamAId,
  teamBId: r.teamBId,
  scoreA: r.scoreA,
  scoreB: r.scoreB,
  status: r.status as MatchStatus,
  version: r.version,
  updatedBy: r.updatedBy,
  updatedAt: r.updatedAt.toISOString(),
})

/** Tick the tournament's live version and tell every listener (sent when the transaction commits). */
async function bumpLive(tx: Tx, tournamentId: number): Promise<number> {
  const [r] = await tx
    .update(tournaments)
    .set({ liveVersion: sql`${tournaments.liveVersion} + 1` })
    .where(eq(tournaments.id, tournamentId))
    .returning({ v: tournaments.liveVersion })
  await tx.execute(sql`select pg_notify('ddp_live', ${JSON.stringify({ t: tournamentId, v: r.v })})`)
  return r.v
}

async function lockDivision(tx: Tx, divisionId: number) {
  const [row] = await tx
    .select({ division: divisions, rules: tournaments.rules })
    .from(divisions)
    .innerJoin(tournaments, eq(tournaments.id, divisions.tournamentId))
    .where(eq(divisions.id, divisionId))
    .limit(1)
    .for('update', { of: divisions })
  if (!row) throw new NotFoundError('division')
  return row
}

/**
 * Lock the division's matches before deciding whether any are scored: a score being saved right now
 * (holding its match row) is waited for and then seen, so a schedule change can't wipe it.
 */
const lockMatches = (tx: Tx, divisionId: number) => tx.execute(sql`select ${matches.id} from ${matches} where ${matches.divisionId} = ${divisionId} for update`)

const scoredMatches = (divisionId: number) =>
  and(eq(matches.divisionId, divisionId), or(sql`${matches.scoreA} is not null`, sql`${matches.scoreB} is not null`, ne(matches.status, 'scheduled')))

/* ---------- reading ---------- */

/** Everything needed to show or run a tournament's play: divisions with teams, players and matches. */
export async function getTournamentPlay(tournamentId: number, db: Executor = getDb()): Promise<TournamentPlay | null> {
  const [t] = await db.select().from(tournaments).where(eq(tournaments.id, tournamentId)).limit(1)
  if (!t) return null
  const divs = await db.select().from(divisions).where(eq(divisions.tournamentId, tournamentId)).orderBy(asc(divisions.sort), asc(divisions.id))
  const teamRows = await db.select().from(teams).where(eq(teams.tournamentId, tournamentId)).orderBy(asc(teams.sort), asc(teams.id))
  const playerRows = teamRows.length
    ? await db.select().from(players).where(inArray(players.teamId, teamRows.map((x) => x.id))).orderBy(asc(players.sort), asc(players.id))
    : []
  const matchRows = await db
    .select()
    .from(matches)
    .where(eq(matches.tournamentId, tournamentId))
    .orderBy(asc(matches.round), asc(matches.slot), asc(matches.court), asc(matches.id))

  const rules = t.rules
  return {
    id: t.id,
    slug: t.slug,
    name: t.name,
    days: t.days ?? [],
    visible: t.visible,
    liveVersion: t.liveVersion,
    rules,
    divisions: divs.map((d) => ({
      id: d.id,
      name: d.name,
      format: d.format as DivisionFormat,
      dayIndex: d.dayIndex,
      startTime: d.startTime,
      gamesTo: d.gamesTo ?? rules.gamesTo,
      gamesPerTeam: d.gamesPerTeam ?? rules.gamesPerTeam,
      winBy2: rules.winBy2,
      playoffs: d.playoffs as DivisionPlay['playoffs'],
      bronze: d.bronze as DivisionPlay['bronze'],
      teams: teamRows
        .filter((x) => x.divisionId === d.id)
        .map((x) => ({
          id: x.id,
          divisionId: x.divisionId,
          name: x.name,
          sort: x.sort,
          players: playerRows
            .filter((p) => p.teamId === x.id)
            .map((p) => ({ id: p.id, name: p.name, dupr: p.dupr, checkedInAt: p.checkedInAt?.toISOString() ?? null })),
        })),
      matches: matchRows.filter((m) => m.divisionId === d.id).map(toMatch),
    })),
  }
}

/** The tournament a division belongs to (for permission checks and redirects). */
export async function tournamentOfDivision(divisionId: number): Promise<number | null> {
  const [r] = await getDb().select({ t: divisions.tournamentId }).from(divisions).where(eq(divisions.id, divisionId)).limit(1)
  return r?.t ?? null
}

/* ---------- teams ---------- */

/** Replace a division's teams (and their players), keeping ids for the ones still listed. Locked once a schedule exists. */
export async function setTeams(divisionId: number, input: TeamInput[]): Promise<void> {
  await getDb().transaction(async (tx) => {
    const { division } = await lockDivision(tx, divisionId)
    const [{ n }] = await tx.select({ n: sql<number>`count(*)::int` }).from(matches).where(eq(matches.divisionId, divisionId))
    if (n > 0) throw new ScheduleExistsError()

    const own = new Set((await tx.select({ id: teams.id }).from(teams).where(eq(teams.divisionId, divisionId))).map((r) => r.id))
    const keep = input.flatMap((x) => (x.id !== undefined && own.has(x.id) ? [x.id] : []))
    await tx.delete(teams).where(keep.length ? and(eq(teams.divisionId, divisionId), notInArray(teams.id, keep)) : eq(teams.divisionId, divisionId))

    for (const [sort, team] of input.entries()) {
      let teamId: number
      if (team.id !== undefined && own.has(team.id)) {
        teamId = team.id
        await tx.update(teams).set({ name: team.name, sort }).where(eq(teams.id, teamId))
      } else {
        const [row] = await tx.insert(teams).values({ tournamentId: division.tournamentId, divisionId, name: team.name, sort }).returning({ id: teams.id })
        teamId = row.id
      }
      const ownPlayers = new Set((await tx.select({ id: players.id }).from(players).where(eq(players.teamId, teamId))).map((r) => r.id))
      const keepPlayers = team.players.flatMap((p) => (p.id !== undefined && ownPlayers.has(p.id) ? [p.id] : []))
      await tx.delete(players).where(keepPlayers.length ? and(eq(players.teamId, teamId), notInArray(players.id, keepPlayers)) : eq(players.teamId, teamId))
      for (const [pSort, p] of team.players.entries()) {
        if (p.id !== undefined && ownPlayers.has(p.id)) await tx.update(players).set({ name: p.name, dupr: p.dupr, sort: pSort }).where(eq(players.id, p.id))
        else await tx.insert(players).values({ teamId, name: p.name, dupr: p.dupr, sort: pSort })
      }
    }
    await bumpLive(tx, division.tournamentId)
  })
}

/* ---------- schedule ---------- */

/** Make (or remake) a division's round-robin schedule. Refused once any score is in. Returns the number of matches. */
export async function generateSchedule(divisionId: number): Promise<number> {
  return getDb().transaction(async (tx) => {
    const { division, rules } = await lockDivision(tx, divisionId)
    await lockMatches(tx, divisionId)
    const [{ n }] = await tx.select({ n: sql<number>`count(*)::int` }).from(matches).where(scoredMatches(divisionId))
    if (n > 0) throw new ScoresExistError()
    const teamIds = (await tx.select({ id: teams.id }).from(teams).where(eq(teams.divisionId, divisionId)).orderBy(asc(teams.sort), asc(teams.id))).map((r) => r.id)
    if (teamIds.length < 2) throw new NotEnoughTeamsError()

    await tx.delete(matches).where(eq(matches.divisionId, divisionId))
    const plan = scheduleDivision({
      teamIds,
      gamesPerTeam: division.gamesPerTeam ?? rules.gamesPerTeam,
      startTime: division.startTime,
      minutesPerRound: division.minutesPerRound,
      firstCourt: division.firstCourt,
      courtCount: division.courtCount,
    })
    if (plan.length) {
      await tx.insert(matches).values(plan.map((m) => ({
        tournamentId: division.tournamentId,
        divisionId,
        stage: 'pool',
        round: m.round,
        slot: m.slot,
        court: m.court,
        startsAt: m.startsAt,
        teamAId: m.teamA,
        teamBId: m.teamB,
      })))
    }
    await bumpLive(tx, division.tournamentId)
    return plan.length
  })
}

/** Remove a division's schedule (so its teams can change). Refused once any score is in. */
export async function clearSchedule(divisionId: number): Promise<void> {
  await getDb().transaction(async (tx) => {
    const { division } = await lockDivision(tx, divisionId)
    await lockMatches(tx, divisionId)
    const [{ n }] = await tx.select({ n: sql<number>`count(*)::int` }).from(matches).where(scoredMatches(divisionId))
    if (n > 0) throw new ScoresExistError()
    await tx.delete(matches).where(eq(matches.divisionId, divisionId))
    await bumpLive(tx, division.tournamentId)
  })
}

/* ---------- scores ---------- */

/**
 * Save a score from a phone or the desk. `expectedVersion` is the version the phone last saw; if
 * someone saved since, StaleMatchError carries the current score. A game can only be marked final
 * once it's finished (games to N, win by 2 if set) unless `force` (time cap), and never as a tie.
 */
export async function saveScore(input: {
  matchId: number
  scoreA: number
  scoreB: number
  status: MatchStatus
  expectedVersion: number
  who: string
  force?: boolean
}): Promise<Match> {
  return getDb().transaction(async (tx) => {
    const [row] = await tx
      .select({ match: matches, gamesTo: divisions.gamesTo, rules: tournaments.rules })
      .from(matches)
      .innerJoin(divisions, eq(divisions.id, matches.divisionId))
      .innerJoin(tournaments, eq(tournaments.id, matches.tournamentId))
      .where(eq(matches.id, input.matchId))
      .limit(1)
      .for('update', { of: matches })
    if (!row) throw new NotFoundError('match')
    const m = row.match
    if (m.version !== input.expectedVersion) throw new StaleMatchError(toMatch(m))
    if (m.teamAId === null || m.teamBId === null) throw new MatchNotReadyError()

    if (input.status === 'final') {
      if (input.scoreA === input.scoreB) throw new TiedGameError()
      const gamesTo = m.stage === 'pool' ? (row.gamesTo ?? row.rules.gamesTo) : row.rules.playoffGamesTo
      if (!input.force && !isGameComplete(input.scoreA, input.scoreB, gamesTo, row.rules.winBy2)) {
        throw new GameNotFinishedError(gamesTo, row.rules.winBy2)
      }
    }
    const status: MatchStatus = input.status === 'scheduled' && (input.scoreA > 0 || input.scoreB > 0) ? 'live' : input.status
    const [updated] = await tx
      .update(matches)
      .set({
        scoreA: input.scoreA,
        scoreB: input.scoreB,
        status,
        version: sql`${matches.version} + 1`,
        updatedBy: input.who.slice(0, 254),
        updatedAt: new Date(),
      })
      .where(eq(matches.id, input.matchId))
      .returning()
    await bumpLive(tx, m.tournamentId)
    return toMatch(updated)
  })
}

/** The tournament a match belongs to. */
export async function tournamentOfMatch(matchId: number): Promise<number | null> {
  const [r] = await getDb().select({ t: matches.tournamentId }).from(matches).where(eq(matches.id, matchId)).limit(1)
  return r?.t ?? null
}
