/** Per court: the match being played now and the one up next, for the projector board. Pure. */
import type { DivisionPlay, Match } from '@/lib/play/repo'
import { STAGE_ORDER } from './present'

export type CourtSlot = { court: number; now: Match | null; next: Match | null; division: string; nextDivision: string | null }

const order = (a: Match, b: Match) =>
  (a.startsAt ?? '99:99').localeCompare(b.startsAt ?? '99:99') || STAGE_ORDER[a.stage] - STAGE_ORDER[b.stage] || a.round - b.round || a.slot - b.slot || a.id - b.id

/** Courts in number order. A court with no live and no scheduled match is left out. */
export function courtBoard(divisions: DivisionPlay[]): CourtSlot[] {
  const byCourt = new Map<number, { m: Match; division: string }[]>()
  for (const d of divisions) {
    for (const m of d.matches) {
      if (m.court === null || m.status === 'final') continue
      const list = byCourt.get(m.court)
      if (list) list.push({ m, division: d.name })
      else byCourt.set(m.court, [{ m, division: d.name }])
    }
  }
  return [...byCourt.keys()]
    .sort((a, b) => a - b)
    .map((court) => {
      const list = byCourt.get(court)!.sort((x, y) => order(x.m, y.m))
      const now = list.find((x) => x.m.status === 'live') ?? null
      const next = list.find((x) => x.m.status === 'scheduled') ?? null
      return { court, now: now?.m ?? null, next: next?.m ?? null, division: (now ?? next)!.division, nextDivision: next?.division ?? null }
    })
}
