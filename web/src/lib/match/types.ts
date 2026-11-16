/**
 * Tournament engine types.
 *
 * Pure TypeScript with zero framework or database imports, so it is safe to
 * use from both server code and client components.
 */

/** A completed match result between two teams, identified by opaque numeric ids. */
export interface MatchResult {
  teamA: number
  teamB: number
  scoreA: number
  scoreB: number
}

/** A team's computed line in the standings. Always derived from results, never stored. */
export interface TeamStanding {
  teamId: number
  wins: number
  losses: number
  gamesPlayed: number
  pointsFor: number
  pointsAgainst: number
  pointDiff: number
  /** Share of total points scored: pointsFor / (pointsFor + pointsAgainst); 0 when no games. */
  pointWinPct: number
  /** 1-based rank after sorting. */
  rank: number
}

/** Tie-breaker rules that can be chained, in order, after wins. */
export type Tiebreaker = 'headToHead' | 'pointDiff' | 'pointsAgainst' | 'pointsFor'
