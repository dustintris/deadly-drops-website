/**
 * How tournament play is shown: match order, stage names and a division's status line. Shared by the
 * public tournament page, the projector board and printable results, so they never disagree. Pure.
 */
import type { DivisionPlay, Match, Stage } from '@/lib/play/repo'
import { divisionBoard, type DivisionBoard } from './board'
import { formatTime12 } from './schedule'
import type { Tiebreaker } from './types'

export const STAGE_ORDER: Record<Stage, number> = { pool: 0, qf: 1, sf: 2, bronze: 3, final: 4 }
export const STAGE_LABELS: Record<Exclude<Stage, 'pool'>, string> = { qf: 'Quarterfinals', sf: 'Semifinals', bronze: 'Bronze match', final: 'Final' }

export const playerLine = (names: string[]) => names.join(names.length === 2 ? ' & ' : ', ')
export const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0')
export const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`
export const hasPlay = (d: DivisionPlay) => d.teams.length > 0 || d.matches.length > 0
export const stageLabel = (m: Pick<Match, 'stage' | 'round'>) => (m.stage === 'pool' ? `Round ${m.round}` : STAGE_LABELS[m.stage])

export const boardMatches = (ms: Match[]) =>
  ms.map((m) => ({ round: m.round, teamA: m.teamAId, teamB: m.teamBId, scoreA: m.scoreA, scoreB: m.scoreB, status: m.status }))

/** Matches in playing order: each pool round, then each playoff stage. */
export function matchGroups(matches: Match[]) {
  const sorted = [...matches].sort(
    (a, b) => STAGE_ORDER[a.stage] - STAGE_ORDER[b.stage] || a.round - b.round || a.slot - b.slot || (a.court ?? 0) - (b.court ?? 0) || a.id - b.id,
  )
  const groups: { key: string; label: string; matches: Match[] }[] = []
  for (const m of sorted) {
    const key = m.stage === 'pool' ? `r${m.round}` : m.stage
    const last = groups[groups.length - 1]
    if (last?.key === key) last.matches.push(m)
    else groups.push({ key, label: stageLabel(m), matches: [m] })
  }
  return groups
}

export type DivisionStatus = {
  /** round-robin standings (playoff games only move the status) */
  board: DivisionBoard
  state: DivisionBoard['state']
  /** "Starts 8:00 AM" | "Live · Round 2" | "Live · Playoffs" | "Final" */
  status: string
  /** a pool game is final, so the ranks mean something */
  ranked: boolean
}

export function divisionStatus(d: DivisionPlay, tiebreakers: Tiebreaker[]): DivisionStatus {
  const pool = d.matches.filter((m) => m.stage === 'pool')
  const board = divisionBoard({ teams: d.teams, matches: boardMatches(pool), tiebreakers })
  const overall = pool.length === d.matches.length ? board : divisionBoard({ teams: d.teams, matches: boardMatches(d.matches), tiebreakers })
  const state = d.matches.length ? overall.state : 'setup'
  const status =
    state === 'final' ? 'Final'
    : state === 'live' ? (board.liveRound !== null ? `Live · Round ${board.liveRound}` : 'Live · Playoffs')
    : `Starts ${formatTime12(d.startTime)}`
  return { board, state, status, ranked: pool.some((m) => m.status === 'final') }
}

export type MedalPlace = 'gold' | 'silver' | 'bronze'
export const MEDAL_PLACES: MedalPlace[] = ['gold', 'silver', 'bronze']
export const MEDAL_LABELS: Record<MedalPlace, string> = { gold: 'Gold', silver: 'Silver', bronze: 'Bronze' }

/**
 * Medals the way the desktop Pickle Match app gives them: the top 3 of the standings, once every
 * game in the division is final. (No playoff brackets yet: they'd decide the medals instead.)
 */
export function medals(d: DivisionPlay, tiebreakers: Tiebreaker[]): { place: MedalPlace; teamId: number }[] {
  const { board, state } = divisionStatus(d, tiebreakers)
  if (state !== 'final') return []
  return board.standings.slice(0, 3).map((s, i) => ({ place: MEDAL_PLACES[i], teamId: s.teamId }))
}
