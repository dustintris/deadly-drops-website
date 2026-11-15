import Link from 'next/link'
import { recentAudit } from '@/lib/audit'
import { readDraft, readPublished } from '@/lib/store/file-store'
import { money } from '@/lib/utils'

export const metadata = { title: 'Dashboard' }

export default async function Dashboard() {
  const [draft, live, log] = await Promise.all([readDraft(), readPublished(), recentAudit(8)])
  const event = live.events.find((e) => e.featured && e.visible) ?? live.events[0]
  const standIns = [
    ...live.gallery.map((g) => g.image.src),
    ...Object.values(live.pages).flatMap((p) => [p.heroImage?.src, p.heroImageMobile?.src]),
  ].filter((s) => s?.startsWith('/images/stand-in/')).length
  const noPhoto = live.products.filter((p) => p.visible && !p.images.length).length

  return (
    <>
      <div className="adm-head"><h1>Dashboard</h1><p className="adm-muted">Draft version {draft.rev}</p></div>

      {event && (
        <section className="adm-card" aria-labelledby="next">
          <div className="adm-head">
            <h2 id="next">Featured tournament: {event.name}</h2>
            <Link className="adm-btn primary" href="/admin/events/">Edit tournament</Link>
          </div>
          <div className="adm-grid">
            <div className="adm-stat"><span className="adm-muted">Date</span><strong>{event.date ?? 'Not set'}</strong></div>
            <div className="adm-stat"><span className="adm-muted">Entry</span><strong>{money(event.entryFee)}</strong></div>
            <div className="adm-stat"><span className="adm-muted">Registration</span><strong>{event.registrationOpen ? 'Open' : 'Closed'}</strong></div>
            <div className="adm-stat"><span className="adm-muted">Sign-up link</span><strong>{event.registrationUrl ? 'Set' : 'Missing'}</strong></div>
          </div>
          {!event.date && <p className="adm-muted">Add the date when it is confirmed: the tournament page then shows a countdown.</p>}
        </section>
      )}

      <section className="adm-card">
        <h2>To do before launch</h2>
        <ul style={{ paddingLeft: 18, display: 'grid', gap: 6 }}>
          <li>{standIns} places still use stock stand-in photos. <Link href="/admin/media/">Upload club photos</Link>.</li>
          <li>{noPhoto} shop products have no photo yet. <Link href="/admin/products/">Add product photos</Link>.</li>
          <li>{live.posts.filter((p) => p.status === 'published').length} community posts are live. <Link href="/admin/community/">Write news</Link>.</li>
        </ul>
      </section>

      <section className="adm-card">
        <h2>Recent activity</h2>
        {log.length ? (
          <table className="adm-table">
            <thead><tr><th scope="col">When</th><th scope="col">Who</th><th scope="col">What</th></tr></thead>
            <tbody>
              {log.map((l, i) => (
                <tr key={i}><td>{new Date(l.at).toLocaleString('en-US')}</td><td>{l.who}</td><td>{l.action}{l.detail ? `: ${l.detail}` : ''}</td></tr>
              ))}
            </tbody>
          </table>
        ) : <p className="adm-muted">Nothing yet.</p>}
      </section>
    </>
  )
}
