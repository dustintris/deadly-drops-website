import Link from 'next/link'
import { eq, sql } from 'drizzle-orm'
import { getDb } from '@/db/client'
import { players, teams } from '@/db/schema'
import { requirePermission } from '@/lib/auth/session'
import { clubToday } from '@/lib/events'
import { listTournaments } from '@/lib/tournaments/repo'

export const metadata = { title: 'Check-in' }
export const dynamic = 'force-dynamic'

type When = 'today' | 'upcoming' | 'past'
const RANK: Record<When, number> = { today: 0, upcoming: 1, past: 2 }

/** Check-in: every tournament with players, today's first, then upcoming soonest first, then past latest first. */
export default async function CheckinAdmin() {
  await requirePermission('checkin', 'view') // each page checks: a layout check alone can be skipped by partial rendering
  const [all, counts] = await Promise.all([
    listTournaments(),
    getDb()
      .select({
        t: teams.tournamentId,
        total: sql<number>`count(*)::int`,
        done: sql<number>`(count(*) filter (where ${players.checkedInAt} is not null))::int`,
      })
      .from(players)
      .innerJoin(teams, eq(teams.id, players.teamId))
      .groupBy(teams.tournamentId),
  ])
  const byId = new Map(counts.map((c) => [c.t, c]))
  const today = clubToday()
  const rows = all.flatMap((t) => {
    const c = byId.get(t.id)
    if (!c || c.total === 0) return []
    const days = [...t.days].sort()
    const when: When = days.includes(today) ? 'today' : days.length && days[days.length - 1] < today ? 'past' : 'upcoming'
    return [{ id: t.id, name: t.name, dateLabel: t.info.dateLabel, visible: t.visible, when, firstDay: days[0] ?? '9999-12-31', ...c }]
  })
  rows.sort((a, b) =>
    RANK[a.when] - RANK[b.when] || (a.when === 'past' ? b.firstDay.localeCompare(a.firstDay) : a.firstDay.localeCompare(b.firstDay)) || a.id - b.id,
  )

  return (
    <>
      <div className="adm-head">
        <div>
          <h1>Check-in</h1>
          <p className="adm-muted">Pick a tournament to check players in as they arrive. The desk updates on every screen at once.</p>
        </div>
      </div>
      <section aria-labelledby="ci-list-h" style={{ display: 'grid', gap: 12 }}>
        <h2 id="ci-list-h">Tournaments with players ({rows.length})</h2>
        {rows.length === 0 ? (
          <p className="adm-muted">No tournament has teams yet. Add them under Tournaments → Teams &amp; schedule.</p>
        ) : (
          <ul className="adm-list">
            {rows.map((r) => (
              <li key={r.id} className="adm-item">
                <Link href={`/admin/checkin/${r.id}/`}
                  style={{ display: 'grid', gap: 4, padding: '14px 16px', minHeight: 56, textDecoration: 'none', borderRadius: 12 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 16, fontWeight: 700, overflowWrap: 'anywhere' }}>
                    {r.name}
                    {r.when === 'today' && <span className="adm-badge on">Today</span>}
                    {!r.visible && <span className="adm-badge off">Hidden</span>}
                  </span>
                  <span className="adm-muted">{r.dateLabel} · {r.done} of {r.total} players checked in</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
