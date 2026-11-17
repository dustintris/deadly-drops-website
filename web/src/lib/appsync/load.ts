import 'server-only'
import { getTournamentPlay } from '@/lib/play/repo'
import { ensureImported, getTournament, listTournaments, type Tournament } from '@/lib/tournaments/repo'
import type { ExportTournament } from './export'

/** A tournament's setup plus its teams, in the shape the desktop export needs. */
async function combine(t: Tournament): Promise<ExportTournament> {
  const play = await getTournamentPlay(t.id)
  const teamsOf = new Map((play?.divisions ?? []).map((d) => [d.id, d.teams]))
  return {
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
      teams: (teamsOf.get(d.id) ?? []).map((x) => ({ name: x.name, players: x.players.map((p) => ({ name: p.name, dupr: p.dupr })) })),
    })),
  }
}

/** Every tournament, hidden drafts included (the app is the director's own tool), earliest first. */
export async function loadAllForApp(): Promise<ExportTournament[]> {
  await ensureImported()
  const all = await listTournaments()
  return Promise.all(all.map(combine))
}

export async function loadForApp(id: number): Promise<ExportTournament | null> {
  await ensureImported()
  const t = await getTournament(id)
  return t ? combine(t) : null
}
