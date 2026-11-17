import { headers } from 'next/headers'
import { appKeyStatus } from '@/lib/appsync/key'
import { skippedTeams } from '@/lib/appsync/export'
import { loadAllForApp } from '@/lib/appsync/load'
import { requirePermission } from '@/lib/auth/session'
import { KeyPanel } from './KeyPanel'

export const metadata = { title: 'Desktop app' }
export const dynamic = 'force-dynamic'

/** Connect the desktop Pickle Match app (the offline backup) so it can download tournaments and teams. */
export default async function DesktopAppAdmin() {
  await requirePermission('staff', 'edit') // each page checks: a layout check alone can be skipped by partial rendering
  const [status, all, h] = await Promise.all([appKeyStatus(), loadAllForApp(), headers()])
  // the configured address (always set in production); a request's own Host header only stands in during development
  const host = process.env.NODE_ENV === 'production' ? '' : (h.get('host') ?? '')
  const origin = process.env.NEXT_PUBLIC_SITE_URL || (host ? `http://${host}` : '')
  const server = origin ? origin + (process.env.NEXT_PUBLIC_BASE_PATH || '') : ''
  const skipped = all.flatMap((t) => skippedTeams(t).map((x) => ({ ...x, tournament: t.name })))

  return (
    <>
      <div className="adm-head">
        <div>
          <h1>Desktop app</h1>
          <p className="adm-muted">
            Lets the Deadly Drops Pickle Match desktop app download tournaments and teams from this website, as an offline
            backup on tournament day. In the app: Load Tournament → download from the management system, then paste the
            address and key below.
          </p>
        </div>
      </div>
      <KeyPanel server={server} set={status.set} createdAt={status.createdAt} />
      <section className="adm-card" aria-labelledby="skip-h" style={{ display: 'grid', gap: 10 }}>
        <h2 id="skip-h">Teams the app won’t get ({skipped.length})</h2>
        {skipped.length === 0 ? (
          <p className="adm-muted">None: every team has two players, which is what the desktop app needs.</p>
        ) : (
          <>
            <p className="adm-muted">The desktop app needs two players per team. Add a partner under Tournaments → Teams &amp; schedule.</p>
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {skipped.map((x, i) => <li key={i}>{x.tournament} · {x.division} · {x.team}</li>)}
            </ul>
          </>
        )}
      </section>
    </>
  )
}
