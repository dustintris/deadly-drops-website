'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { audit } from '@/lib/audit'
import { can, type Area } from '@/lib/auth/permissions'
import { getSession, type Session } from '@/lib/auth/session'
import { text } from '@/lib/content-schema'
import {
  BracketStartedError,
  clearSchedule,
  drawPlayoffs,
  GameNotFinishedError,
  generateSchedule,
  MatchNotReadyError,
  NotEnoughTeamsError,
  NotFoundError,
  NoPlayoffsError,
  PlayoffScoresExistError,
  PlayoffsExistError,
  PoolNotFinishedError,
  resetPlayoffs,
  saveScore,
  ScheduleExistsError,
  ScoresExistError,
  setCheckedIn,
  setTeams,
  StaleMatchError,
  TiedGameError,
  TooFewTeamsError,
  type Match,
  type Player,
} from '@/lib/play/repo'

/**
 * Pickle Match actions. Teams and schedules need `tournaments: edit`; entering scores needs
 * `scoring: edit` (so a scorekeeper can score without changing the setup); the check-in desk needs
 * `checkin: edit`. Checked here, on the server.
 */

export type PlayResult = { ok: boolean; message: string; errors?: Record<string, string>; match?: Match; count?: number; players?: Pick<Player, 'id' | 'checkedInAt'>[] }

const Id = z.number().int().positive()
const TeamsInput = z
  .array(
    z.object({
      id: Id.optional(),
      name: text(1, 60, 'Team name'),
      players: z
        .array(z.object({ id: Id.optional(), name: text(1, 60, 'Player name'), dupr: z.string().trim().max(10, 'DUPR can be at most 10 characters.') }))
        .min(1, 'Each team needs at least one player.')
        .max(4, 'Up to 4 players per team.'),
    }),
  )
  .max(64, 'Up to 64 teams per division.')
const ScoreInput = z.object({
  matchId: Id,
  scoreA: z.number().int().min(0).max(99),
  scoreB: z.number().int().min(0).max(99),
  status: z.enum(['scheduled', 'live', 'final']),
  version: Id,
  force: z.boolean().optional(),
})

const CheckinInput = z.object({
  tournamentId: Id,
  playerIds: z.array(Id).min(1).max(8),
  checkedIn: z.boolean(),
})

const KNOWN = [
  ScheduleExistsError, ScoresExistError, NotEnoughTeamsError, GameNotFinishedError, TiedGameError, MatchNotReadyError, NotFoundError,
  NoPlayoffsError, PlayoffsExistError, PoolNotFinishedError, TooFewTeamsError, PlayoffScoresExistError, BracketStartedError,
]

const DENIED: Partial<Record<Area, string>> = {
  scoring: 'Your login can’t enter scores.',
  checkin: 'Your login can’t check players in.',
}

async function allowed(area: Area): Promise<Session | PlayResult> {
  const s = await getSession()
  if (!s) return { ok: false, message: 'Your session ended. Sign in again.' }
  if (!can(s, area, 'edit')) return { ok: false, message: DENIED[area] ?? 'Your login can’t change teams or schedules.' }
  return s
}
const refused = (x: Session | PlayResult): x is PlayResult => 'ok' in x

function failure(e: unknown, fallback: string): PlayResult {
  if (e instanceof StaleMatchError) return { ok: false, message: e.message, match: e.current }
  if (KNOWN.some((k) => e instanceof k)) return { ok: false, message: (e as Error).message }
  console.error(e)
  return { ok: false, message: fallback }
}

function fieldErrors(issues: z.ZodIssue[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const i of issues) out[i.path.join('.') || '_'] ??= i.message
  return out
}

/** Replace a division's teams (allowed until its schedule exists). */
export async function setTeamsAction(divisionId: unknown, input: unknown): Promise<PlayResult> {
  const s = await allowed('tournaments')
  if (refused(s)) return s
  const id = Id.safeParse(divisionId)
  if (!id.success) return { ok: false, message: 'Unknown division.' }
  const parsed = TeamsInput.safeParse(input)
  if (!parsed.success) return { ok: false, message: 'Fix the highlighted fields.', errors: fieldErrors(parsed.error.issues) }
  try {
    await setTeams(id.data, parsed.data)
    await audit(s.email, 'teams_save', `division ${id.data}: ${parsed.data.length} teams`)
    revalidatePath('/', 'layout')
    return { ok: true, message: `Saved ${parsed.data.length} team${parsed.data.length === 1 ? '' : 's'}.` }
  } catch (e) {
    return failure(e, 'Saving the teams failed on the server. Try again.')
  }
}

/** Make the round-robin schedule (replacing one with no scores yet). */
export async function generateScheduleAction(divisionId: unknown): Promise<PlayResult> {
  const s = await allowed('tournaments')
  if (refused(s)) return s
  const id = Id.safeParse(divisionId)
  if (!id.success) return { ok: false, message: 'Unknown division.' }
  try {
    const count = await generateSchedule(id.data)
    await audit(s.email, 'schedule_generate', `division ${id.data}: ${count} matches`)
    revalidatePath('/', 'layout')
    return { ok: true, message: `Schedule made: ${count} matches.`, count }
  } catch (e) {
    return failure(e, 'Making the schedule failed on the server. Try again.')
  }
}

export async function clearScheduleAction(divisionId: unknown): Promise<PlayResult> {
  const s = await allowed('tournaments')
  if (refused(s)) return s
  const id = Id.safeParse(divisionId)
  if (!id.success) return { ok: false, message: 'Unknown division.' }
  try {
    await clearSchedule(id.data)
    await audit(s.email, 'schedule_clear', `division ${id.data}`)
    revalidatePath('/', 'layout')
    return { ok: true, message: 'Schedule cleared. You can change the teams now.' }
  } catch (e) {
    return failure(e, 'Clearing the schedule failed on the server. Try again.')
  }
}

/** Draw a division's playoffs from the final pool standings (normally automatic when pool play ends). */
export async function drawPlayoffsAction(divisionId: unknown): Promise<PlayResult> {
  const s = await allowed('tournaments')
  if (refused(s)) return s
  const id = Id.safeParse(divisionId)
  if (!id.success) return { ok: false, message: 'Unknown division.' }
  try {
    const count = await drawPlayoffs(id.data)
    await audit(s.email, 'playoffs_draw', `division ${id.data}: ${count} games`)
    revalidatePath('/', 'layout')
    return { ok: true, message: `Playoffs drawn: ${count} games.`, count }
  } catch (e) {
    return failure(e, 'Drawing the playoffs failed on the server. Try again.')
  }
}

/** Remove a division's unplayed playoff games, e.g. to change its playoff format. */
export async function resetPlayoffsAction(divisionId: unknown): Promise<PlayResult> {
  const s = await allowed('tournaments')
  if (refused(s)) return s
  const id = Id.safeParse(divisionId)
  if (!id.success) return { ok: false, message: 'Unknown division.' }
  try {
    await resetPlayoffs(id.data)
    await audit(s.email, 'playoffs_reset', `division ${id.data}`)
    revalidatePath('/', 'layout')
    return { ok: true, message: 'Playoffs reset. Draw them again when you’re ready.' }
  } catch (e) {
    return failure(e, 'Resetting the playoffs failed on the server. Try again.')
  }
}

/** Save a score from the score pad. A stale version returns the current match so the pad can show it. */
export async function saveScoreAction(input: unknown): Promise<PlayResult> {
  const s = await allowed('scoring')
  if (refused(s)) return s
  const parsed = ScoreInput.safeParse(input)
  if (!parsed.success) return { ok: false, message: 'Scores must be whole numbers from 0 to 99.' }
  const { matchId, scoreA, scoreB, status, version, force } = parsed.data
  try {
    const match = await saveScore({ matchId, scoreA, scoreB, status, expectedVersion: version, who: s.email, force })
    if (status === 'final') await audit(s.email, 'score_final', `match ${matchId}: ${scoreA}-${scoreB}${force ? ' (time cap)' : ''}`)
    return { ok: true, message: status === 'final' ? `Final: ${scoreA}–${scoreB}.` : 'Saved.', match }
  } catch (e) {
    return failure(e, 'Saving the score failed on the server. Try again.')
  }
}

/** Check players in at the desk, or undo it. Every open screen follows through the live feed. */
export async function setCheckedInAction(input: unknown): Promise<PlayResult> {
  const s = await allowed('checkin')
  if (refused(s)) return s
  const parsed = CheckinInput.safeParse(input)
  if (!parsed.success) return { ok: false, message: 'Pick up to 8 players at a time.' }
  const { tournamentId, playerIds, checkedIn } = parsed.data
  try {
    const out = await setCheckedIn({ tournamentId, playerIds, checkedIn, who: s.email })
    await audit(s.email, checkedIn ? 'checkin' : 'checkin_undo', `tournament ${tournamentId}: players ${playerIds.join(', ')}`)
    return {
      ok: true,
      message: checkedIn ? `Checked in ${out.length === 1 ? '1 player' : `${out.length} players`}.` : 'Check-in undone.',
      players: out.map((p) => ({ id: p.id, checkedInAt: p.checkedInAt })),
    }
  } catch (e) {
    return failure(e, 'Checking in failed on the server. Try again.')
  }
}
