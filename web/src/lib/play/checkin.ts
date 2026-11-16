/** The check-in desk's roster: search and counts. Pure, so it runs on the desk without a round trip. */

export type RosterPlayer = { id: number; name: string; checkedInAt: string | null }
export type RosterTeam = { id: number; name: string; players: RosterPlayer[] }
export type RosterDivision = { id: number; name: string; dayIndex: number; teams: RosterTeam[] }

/** "José" and "jose" match: lower case, accents removed. */
export const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim()

export const teamComplete = (t: RosterTeam) => t.players.length > 0 && t.players.every((p) => p.checkedInAt !== null)

/**
 * Divisions and teams that match. A search hits team or player names and always shows the whole
 * team (a partner is checked in at the same table). Divisions left with no team are dropped.
 */
export function filterRoster(divs: RosterDivision[], opts: { q?: string; divisionId?: number | null; onlyMissing?: boolean }): RosterDivision[] {
  const q = fold(opts.q ?? '')
  if (!q && opts.divisionId == null && !opts.onlyMissing) return divs
  return divs
    .filter((d) => opts.divisionId == null || d.id === opts.divisionId)
    .map((d) => ({
      ...d,
      teams: d.teams.filter(
        (t) => (!opts.onlyMissing || !teamComplete(t)) && (!q || fold(t.name).includes(q) || t.players.some((p) => fold(p.name).includes(q))),
      ),
    }))
    .filter((d) => d.teams.length > 0)
}

export function rosterCounts(divs: RosterDivision[]) {
  const teams = divs.flatMap((d) => d.teams)
  const ps = teams.flatMap((t) => t.players)
  return { players: ps.length, checkedIn: ps.filter((p) => p.checkedInAt !== null).length, teams: teams.length, teamsComplete: teams.filter(teamComplete).length }
}
