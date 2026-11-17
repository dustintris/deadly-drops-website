/**
 * The desktop Pickle Match app's download format (its "Load Tournament → download from the web
 * management system"). Mirrors the contract in the app's repo: src/lib/serverConnection.ts and
 * src/model/importTournament.ts, as served by its own server/src/lib/export-format.ts. Pure.
 *
 * The app needs exactly two players per team and rejects the whole file otherwise, so a team with
 * one player is left out (the admin's Desktop app page lists them) and bigger teams send their first two.
 */

export type ExportTournament = {
  id: number
  name: string
  days: string[]
  divisions: {
    id: number
    name: string
    format: string
    sort: number
    teamLimit: number | null
    firstCourt: number
    courtCount: number
    teams: { name: string; players: { name: string; dupr: string }[] }[]
  }[]
}

const APP_FORMATS = new Set(['mens', 'womens', 'mixed'])
const ordered = (t: ExportTournament) => [...t.divisions].sort((a, b) => a.sort - b.sort || a.id - b.id)
const exportable = (team: { players: unknown[] }) => team.players.length >= 2

export function toImportFormat(t: ExportTournament): unknown {
  const highest = Math.max(1, ...t.divisions.map((d) => d.firstCourt + d.courtCount - 1))
  return {
    name: t.name,
    date: t.days[0] ?? '',
    courts: Math.min(12, highest),
    divisions: ordered(t).map((d) => ({
      name: d.name,
      format: APP_FORMATS.has(d.format) ? d.format : 'mixed',
      teamLimit: d.teamLimit,
      externalId: String(d.id),
      teams: d.teams.filter(exportable).map((team) => ({
        name: team.name,
        players: team.players.slice(0, 2).map((p) => ({ name: p.name, dupr: p.dupr, shirtSize: '', meal: '' })),
      })),
    })),
  }
}

/** One row of the app's tournament picker. `skipped` = teams left out for having one player. */
export function toSummary(t: ExportTournament) {
  const teams = t.divisions.flatMap((d) => d.teams)
  return {
    id: String(t.id),
    name: t.name,
    date: t.days[0] ?? '',
    divisions: t.divisions.length,
    teams: teams.filter(exportable).length,
    waitlisted: 0,
    skipped: teams.filter((x) => !exportable(x)).length,
  }
}

export function skippedTeams(t: ExportTournament): { division: string; team: string }[] {
  return ordered(t).flatMap((d) => d.teams.filter((x) => !exportable(x)).map((x) => ({ division: d.name, team: x.name })))
}
