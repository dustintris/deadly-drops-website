import { computeStandings } from './standings'
import type { MatchResult, TeamStanding, Tiebreaker } from './types'

export interface BoardInput {
  teams: { id: number; name: string }[]
  matches: {
    round: number
    teamA: number | null
    teamB: number | null
    scoreA: number | null
    scoreB: number | null
    status: 'scheduled' | 'live' | 'final'
  }[]
  tiebreakers: Tiebreaker[]
}

export interface DivisionBoard {
  standings: (TeamStanding & { name: string })[]
  /** Lowest round that still has a non-final match; null when all are final or none exist. */
  liveRound: number | null
  state: 'setup' | 'live' | 'final'
  /** 'SETUP' | 'LIVE · RD 3' | 'FINAL' */
  label: string
}

/**
 * Standings plus live-round/status for one division. Only matches marked
 * 'final' count toward standings, so a score still being entered never moves
 * the table. The division is SETUP until something has started (a match is
 * live or final), LIVE until every match is final, then FINAL.
 */
export function divisionBoard(input: BoardInput): DivisionBoard {
  const { teams, matches, tiebreakers } = input

  const results: MatchResult[] = []
  for (const m of matches) {
    if (m.status !== 'final') continue
    if (m.teamA === null || m.teamB === null || m.scoreA === null || m.scoreB === null) continue
    results.push({ teamA: m.teamA, teamB: m.teamB, scoreA: m.scoreA, scoreB: m.scoreB })
  }
  const names = new Map(teams.map((t) => [t.id, t.name]))
  const standings = computeStandings(
    teams.map((t) => t.id),
    results,
    tiebreakers,
  ).map((row) => ({ ...row, name: names.get(row.teamId) ?? '' }))

  const unfinished = matches.filter((m) => m.status !== 'final')
  const liveRound = unfinished.length ? Math.min(...unfinished.map((m) => m.round)) : null
  const started = matches.some((m) => m.status !== 'scheduled')

  if (matches.length === 0 || !started) {
    return { standings, liveRound, state: 'setup', label: 'SETUP' }
  }
  if (liveRound === null) return { standings, liveRound, state: 'final', label: 'FINAL' }
  return { standings, liveRound, state: 'live', label: `LIVE · RD ${liveRound}` }
}
