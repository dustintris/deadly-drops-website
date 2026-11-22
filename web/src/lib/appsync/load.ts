import 'server-only'
import { asc, inArray } from 'drizzle-orm'
import { getDb } from '@/db/client'
import { players, teams } from '@/db/schema'
import { ensureImported, getTournament, listTournaments, type Tournament } from '@/lib/tournaments/repo'
import type { ExportTournament } from './export'

/** Tournaments' setup plus their teams and players (two queries for any number of tournaments; no matches). */
async function combine(ts: Tournament[]): Promise<ExportTournament[]> {
  const ids = ts.map((t) => t.id)
  const teamRows = ids.length
    ? await getDb().select().from(teams).where(inArray(teams.tournamentId, ids)).orderBy(asc(teams.sort), asc(teams.id))
    : []
  const playerRows = teamRows.length
    ? await getDb().select().from(players).where(inArray(players.teamId, teamRows.map((x) => x.id))).orderBy(asc(players.sort), asc(players.id))
    : []
  const playersOf = new Map<number, { name: string; dupr: string }[]>()
  for (const p of playerRows) {
    const list = playersOf.get(p.teamId) ?? []
    list.push({ name: p.name, dupr: p.dupr })
    playersOf.set(p.teamId, list)
  }
  return ts.map((t) => ({
    id: t.id,
    name: t.name,
    days: t.days,
    divisions: t.divisions.map((d) => ({
      id: d.id,
      name: d.name,
      format: d.format,
      sort: d.sort,
      teamLimit: d.teamLimit,
      firstCourt: d.firstCourt,
      courtCount: d.courtCount,
      teams: teamRows.filter((x) => x.divisionId === d.id).map((x) => ({ name: x.name, players: playersOf.get(x.id) ?? [] })),
    })),
  }))
}

/**
 * Every tournament, hidden drafts included (the app is the director's own tool), earliest first and undated ones
 * last: the order the desktop app has always received. The website lists the latest first, so this reverses it.
 */
export async function loadAllForApp(): Promise<ExportTournament[]> {
  await ensureImported()
  return combine([...(await listTournaments())].reverse())
}

export async function loadForApp(id: number): Promise<ExportTournament | null> {
  await ensureImported()
  const t = await getTournament(id)
  return t ? (await combine([t]))[0] : null
}
