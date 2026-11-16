import type { MatchResult, TeamStanding, Tiebreaker } from './types'

export type { Tiebreaker }

export const DEFAULT_TIEBREAKERS: Tiebreaker[] = ['pointDiff', 'pointsFor']

/**
 * Compute standings for a set of teams from completed match results.
 *
 * Teams are ranked by wins first; ties are then resolved by the configurable
 * `tiebreakers` chain. Head-to-head is evaluated within the tied group, so a
 * circular tie (A beats B, B beats C, C beats A) leaves the group level and
 * falls through to the next rule deterministically. Teams equal on every rule
 * are ordered by team id so results are stable.
 */
export function computeStandings(
  teamIds: number[],
  results: MatchResult[],
  tiebreakers: Tiebreaker[] = DEFAULT_TIEBREAKERS,
): TeamStanding[] {
  const byTeam = new Map<number, TeamStanding>()
  for (const id of teamIds) {
    byTeam.set(id, {
      teamId: id,
      wins: 0,
      losses: 0,
      gamesPlayed: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      pointDiff: 0,
      pointWinPct: 0,
      rank: 0,
    })
  }

  for (const m of results) {
    const a = byTeam.get(m.teamA)
    const b = byTeam.get(m.teamB)
    if (!a || !b) continue
    a.pointsFor += m.scoreA
    a.pointsAgainst += m.scoreB
    a.gamesPlayed++
    b.pointsFor += m.scoreB
    b.pointsAgainst += m.scoreA
    b.gamesPlayed++
    if (m.scoreA > m.scoreB) {
      a.wins++
      b.losses++
    } else {
      b.wins++
      a.losses++
    }
  }

  const rows = [...byTeam.values()]
  for (const r of rows) {
    r.pointDiff = r.pointsFor - r.pointsAgainst
    const total = r.pointsFor + r.pointsAgainst
    r.pointWinPct = total ? r.pointsFor / total : 0
  }

  const winValues = [...new Set(rows.map((r) => r.wins))].sort((a, b) => b - a)
  const ordered: TeamStanding[] = []
  for (const wins of winValues) {
    ordered.push(
      ...resolveTies(
        rows.filter((r) => r.wins === wins),
        tiebreakers,
        results,
      ),
    )
  }
  ordered.forEach((r, i) => {
    r.rank = i + 1
  })
  return ordered
}

function tiebreakMetric(
  team: TeamStanding,
  rule: Tiebreaker,
  group: TeamStanding[],
  results: MatchResult[],
): number {
  switch (rule) {
    case 'pointDiff':
      return team.pointDiff
    case 'pointsFor':
      return team.pointsFor
    case 'pointsAgainst':
      // fewer points against is better
      return -team.pointsAgainst
    case 'headToHead': {
      const groupIds = new Set(group.map((g) => g.teamId))
      let wins = 0
      for (const m of results) {
        if (!groupIds.has(m.teamA) || !groupIds.has(m.teamB)) continue
        if (m.teamA === team.teamId && m.scoreA > m.scoreB) wins++
        else if (m.teamB === team.teamId && m.scoreB > m.scoreA) wins++
      }
      return wins
    }
  }
}

function resolveTies(
  group: TeamStanding[],
  chain: Tiebreaker[],
  results: MatchResult[],
): TeamStanding[] {
  if (group.length <= 1) return group
  if (chain.length === 0) return [...group].sort((a, b) => a.teamId - b.teamId)

  const [rule, ...rest] = chain
  const metric = new Map(group.map((t) => [t.teamId, tiebreakMetric(t, rule, group, results)]))
  const sorted = [...group].sort((a, b) => metric.get(b.teamId)! - metric.get(a.teamId)!)

  const out: TeamStanding[] = []
  let i = 0
  while (i < sorted.length) {
    let j = i
    while (j < sorted.length && metric.get(sorted[j].teamId) === metric.get(sorted[i].teamId)) j++
    out.push(...resolveTies(sorted.slice(i, j), rest, results))
    i = j
  }
  return out
}
