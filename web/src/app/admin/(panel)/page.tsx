import Link from 'next/link'
import { recentAudit, type AuditEntry } from '@/lib/audit'
import { getNextEvent } from '@/lib/data'
import { readDraft, readPublished } from '@/lib/store/content-store'
import { ensureImported, listTournaments, toClubEvent, type Tournament } from '@/lib/tournaments/repo'
import { money } from '@/lib/utils'
import { AREAS, AREA_LABELS, can, type Area } from '@/lib/auth/permissions'
import { requireAdmin } from '@/lib/auth/session'
import { countOpenMessages } from '@/lib/inbox/repo'

export const metadata = { title: 'Dashboard' }

const isArea = (v: unknown): v is Area => typeof v === 'string' && (AREAS as readonly string[]).includes(v)

export default async function Dashboard({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const s = await requireAdmin() // each page checks: a layout check alone can be skipped by partial rendering
  // requirePermission sends people here with ?denied=<area> when a screen isn't theirs
  const { denied } = await searchParams
  const deniedArea = isArea(denied) ? denied : null

  const seeTournaments = can(s, 'tournaments')
  const seeContent = can(s, 'content')
  const seeShop = can(s, 'shop')
  // the activity log covers every area (and sign-ins), so it is for people who oversee staff
  const seeActivity = can(s, 'staff')

  const [draft, live, log, next, tournaments, openMessages] = await Promise.all([
    readDraft(),
    readPublished(),
    seeActivity ? recentAudit(8) : Promise.resolve<AuditEntry[]>([]),
    seeTournaments ? getNextEvent() : Promise.resolve(null),
    seeTournaments ? ensureImported().then(() => listTournaments()) : Promise.resolve<Tournament[]>([]),
    seeContent ? countOpenMessages() : Promise.resolve(0),
  ])
  // the one the website leads with; while none is shown, the first (hidden) one so it can be finished
  const tournament = next ? tournaments.find((t) => t.slug === next.slug) : tournaments[0]
  const event = next ?? (tournament ? toClubEvent(tournament) : undefined)
  const eventHref = tournament ? `/admin/tournaments/${tournament.id}/` : '/admin/tournaments/'
  const standIns = [
    ...live.gallery.map((g) => g.image.src),
    ...Object.values(live.pages).flatMap((p) => [p.heroImage?.src, p.heroImageMobile?.src]),
  ].filter((src) => src?.startsWith('/images/stand-in/')).length
  const noPhoto = live.products.filter((p) => p.visible && !p.images.length).length
  const noFlyer = live.charities.filter((c) => !c.flyer).length

  const todos = [
    seeContent && openMessages > 0 && (
      <li key="inbox">{openMessages} {openMessages === 1 ? 'message' : 'messages'} from the Contact page to answer. <Link href="/admin/inbox/">Open the Inbox</Link>.</li>
    ),
    seeContent && <li key="photos">{standIns} places still use stock stand-in photos. <Link href="/admin/media/">Upload club photos</Link>.</li>,
    seeContent && noFlyer > 0 && <li key="flyers">{noFlyer} {noFlyer === 1 ? 'charity has' : 'charities have'} no flyer yet. <Link href="/admin/charities/">Add charity flyers</Link>.</li>,
    seeShop && <li key="shop">{noPhoto} shop products have no photo yet. <Link href="/admin/products/">Add product photos</Link>.</li>,
    seeContent && <li key="posts">{live.posts.filter((p) => p.status === 'published').length} community posts are live. <Link href="/admin/community/">Write news</Link>.</li>,
  ].filter(Boolean)

  return (
    <>
      <div className="adm-head"><h1>Dashboard</h1><p className="adm-muted">Draft version {draft.rev}</p></div>

      {deniedArea && (
        <p className="adm-card" role="status" style={{ fontWeight: 600 }}>
          You don&rsquo;t have access to {AREA_LABELS[deniedArea]}. Ask the owner if you need it.
        </p>
      )}

      {event && (
        <section className="adm-card" aria-labelledby="next">
          <div className="adm-head">
            <h2 id="next">
              {event.featured ? 'Featured' : 'Next'} tournament: {event.name}
              {event.visible === false && <> <span className="adm-badge off">Hidden</span></>}
            </h2>
            <Link className="adm-btn primary" href={eventHref}>{can(s, 'tournaments', 'edit') ? 'Edit tournament' : 'View tournament'}</Link>
          </div>
          <div className="adm-grid">
            <div className="adm-stat"><span className="adm-muted">Date</span><strong>{event.date ? event.dateLabel : 'Not set'}</strong></div>
            <div className="adm-stat"><span className="adm-muted">Entry</span><strong>{money(event.entryFee)}</strong></div>
            <div className="adm-stat"><span className="adm-muted">Registration</span><strong>{event.registrationOpen ? 'Open' : 'Closed'}</strong></div>
            <div className="adm-stat"><span className="adm-muted">Main Court link</span><strong>{event.registrationUrl ? 'Set' : 'Missing'}</strong></div>
          </div>
          {!event.date && <p className="adm-muted">Add the date when it is confirmed: the tournament page then shows a countdown.</p>}
        </section>
      )}

      {todos.length > 0 && (
        <section className="adm-card">
          <h2>To do before launch</h2>
          <ul style={{ paddingLeft: 18, display: 'grid', gap: 6 }}>{todos}</ul>
        </section>
      )}

      {seeActivity && (
        <section className="adm-card">
          <h2>Recent activity</h2>
          {log.length ? (
            <table className="adm-table">
              <thead><tr><th scope="col">When</th><th scope="col">Who</th><th scope="col">What</th></tr></thead>
              <tbody>
                {log.map((l, i) => (
                  <tr key={i}><td>{new Date(l.at).toLocaleString('en-US', { timeZone: 'America/Los_Angeles', dateStyle: 'medium', timeStyle: 'short' })} PT</td><td>{l.who}</td><td>{l.action}{l.detail ? `: ${l.detail}` : ''}</td></tr>
                ))}
              </tbody>
            </table>
          ) : <p className="adm-muted">Nothing yet.</p>}
        </section>
      )}

      {!event && !todos.length && !seeActivity && (
        <p className="adm-muted">Nothing to show here for your login. Use the menu to open the screens you can use.</p>
      )}
    </>
  )
}
