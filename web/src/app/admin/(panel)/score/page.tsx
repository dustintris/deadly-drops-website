import Link from 'next/link'
import { sql } from 'drizzle-orm'
import { getDb } from '@/db/client'
import { matches } from '@/db/schema'
import { requirePermission } from '@/lib/auth/session'
import { clubToday } from '@/lib/events'
import { listTournaments } from '@/lib/tournaments/repo'

export const metadata = { title: 'Scoring' }
export const dynamic = 'force-dynamic'

type Row = {
  id: number
  name: string
  dateLabel: string
  visible: boolean
  when: 'today' | 'upcoming' | 'past'
  firstDay: string
  total: number
  live: number
  done: number
}

const RANK: Record<Row['when'], number> = { today: 0, upcoming: 1, past: 2 }

/**
 * Scoring: every tournament that has a schedule. Today's come first (biggest first), then the
 * upcoming ones soonest first, then past ones latest first. Each opens the phone score screen.
 */
export default async function ScoringAdmin() {
  await requirePermission('scoring', 'view') // each page checks: a layout check alone can be skipped by partial rendering
  const [all, counts] = await Promise.all([
    listTournaments(),
    getDb()
      .select({
        t: matches.tournamentId,
        total: sql<number>`count(*)::int`,
        live: sql<number>`(count(*) filter (where ${matches.status} = 'live'))::int`,
        done: sql<number>`(count(*) filter (where ${matches.status} = 'final'))::int`,
      })
      .from(matches)
      .groupBy(matches.tournamentId),
  ])
  const byId = new Map(counts.map((c) => [c.t, c]))
  const today = clubToday()

  const rows: Row[] = all.flatMap((t) => {
    const c = byId.get(t.id)
    if (!c || c.total === 0) return []
    const days = [...t.days].sort()
    const when: Row['when'] = days.includes(today) ? 'today' : days.length && days[days.length - 1] < today ? 'past' : 'upcoming'
    return [{ id: t.id, name: t.name, dateLabel: t.info.dateLabel, visible: t.visible, when, firstDay: days[0] ?? '9999-12-31', total: c.total, live: c.live, done: c.done }]
  })
  rows.sort((a, b) =>
    RANK[a.when] - RANK[b.when] ||
    (a.when === 'today' ? b.total - a.total : a.when === 'past' ? b.firstDay.localeCompare(a.firstDay) : a.firstDay.localeCompare(b.firstDay)) ||
    a.id - b.id,
  )

  return (
    <>
      <div className="adm-head">
        <div>
          <h1>Scoring</h1>
          <p className="adm-muted">Pick a tournament to enter scores. Scores show on the website and the venue screens as soon as they’re saved.</p>
        </div>
      </div>
      <section aria-labelledby="score-list-h" style={{ display: 'grid', gap: 12 }}>
        <h2 id="score-list-h">Tournaments with a schedule ({rows.length})</h2>
        {rows.length === 0 ? (
          <p className="adm-muted">No tournament has a schedule yet. Make one under Tournaments → Teams &amp; schedule.</p>
        ) : (
          <ul className="adm-list">
            {rows.map((r) => (
              <li key={r.id} className="adm-item">
                <Link href={`/admin/score/${r.id}/`}
                  style={{ display: 'grid', gap: 4, padding: '14px 16px', minHeight: 56, textDecoration: 'none', borderRadius: 12 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 16, fontWeight: 700, overflowWrap: 'anywhere' }}>
                    {r.name}
                    {r.when === 'today' && <span className="adm-badge on">Today</span>}
                    {r.live > 0 && <span className="adm-badge on">{r.live} live</span>}
                    {!r.visible && <span className="adm-badge off">Hidden</span>}
                  </span>
                  <span className="adm-muted">
                    {r.dateLabel} · {r.total} {r.total === 1 ? 'match' : 'matches'} · {r.done} finished
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
