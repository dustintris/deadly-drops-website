import type { Metadata } from 'next'
import Link from 'next/link'
import { Monogram } from '@/components/Monogram'
import { PageHero } from '@/components/PageHero'
import a from '@/components/about.module.css'
import { getClub, getCommittee, getNextEvent } from '@/lib/data'
import { asset, money } from '@/lib/utils'

export const metadata: Metadata = { title: 'About us' }

export default async function AboutPage() {
  const [club, committee, event] = await Promise.all([getClub(), getCommittee(), getNextEvent()])
  const gold = event.prizes.find((p) => p.place === 'Gold')

  const stats = [
    { value: money(event.entryFee), label: 'Tournament entry', accent: true },
    { value: 'DUPR', label: 'Friendly divisions' },
    { value: gold ? money(gold.amount) : '—', label: 'Gold prize' },
    { value: 'All ages', label: 'Every level welcome', accent: true },
  ]
  const values = [
    { title: 'Anyone can walk on', body: 'An inclusive club where every age and every skill level belongs. Register, show up, and we find you a game.' },
    { title: 'Your division is earned', body: 'Ratings decide the matchups. DUPR-friendly divisions keep every bracket fair, from first season to sharp.' },
    { title: 'Competitive, not precious', body: 'We sharpen competitive skills and keep score, and sportsmanship comes first.' },
  ]

  return (
    <>
      <PageHero
        eyebrow="Chula Vista, CA"
        title="Tournaments for every age and level"
        lede={club.tagline}
        photo="/images/stand-in/player-lunge.jpg"
        photoPosition="60% 30%"
      />

      <dl className={a.stats}>
        {stats.map((s) => (
          <div key={s.label} className="stat">
            <dt className="sr">{s.label}</dt>
            <dd><strong className={s.accent ? 'accent' : undefined}>{s.value}</strong><span>{s.label}</span></dd>
          </div>
        ))}
      </dl>

      <section className="section light">
        <div className="wrap split">
          <div className="stack-16">
            <p className="eyebrow">Who we are</p>
            <h2 className="display d-m">Tournaments with a community around them</h2>
            <p className="muted">{club.about}</p>
            <ul className="chips" style={{ listStyle: 'none', padding: 0 }}>
              {club.highlights.map((h) => <li key={h} className="tag">{h}</li>)}
            </ul>
          </div>
          <div className={a.collage}>
            <img src={asset('/images/stand-in/court-line.jpg')} alt="" loading="lazy" />
            <img src={asset('/images/stand-in/ball-on-blue-court.jpg')} alt="" loading="lazy" />
            <img src={asset('/images/stand-in/player-forehand-night.jpg')} alt="" loading="lazy" />
          </div>
        </div>
      </section>

      <section className="section dark">
        <div className="wrap">
          <h2 className="display d-m">What we mean by open</h2>
          <ul className={a.values}>
            {values.map((v, i) => (
              <li key={v.title} data-accent={i === 1}>
                <strong className="display">{String(i + 1).padStart(2, '0')}</strong>
                <h3>{v.title}</h3>
                <p>{v.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section dark rule-top">
        <div className="wrap">
          <div className="head-row">
            <div className="stack-8">
              <p className="eyebrow">Who runs it</p>
              <h2 className="display d-m">All members, all volunteers</h2>
            </div>
            <Link href="/members/" className="link-arrow">Meet the full roster →</Link>
          </div>
          <ul className={a.team}>
            {committee.map((c) => (
              <li key={c.member.slug} className="card">
                <Link href={`/members/${c.member.slug}/`}>
                  <div className={a.teamTile}><Monogram member={c.member} /></div>
                  <div className={a.teamBody}>
                    <strong>{c.member.name}</strong>
                    <span className="eyebrow">{c.role}</span>
                    <p>{c.note}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="light">
        <div className={`wrap ${a.visit}`}>
          <div className="stack-16">
            <p className="eyebrow">Come play</p>
            <h2 className="display d-m">Next on court: {event.name}</h2>
            <p className="muted">{event.summary} Entry {money(event.entryFee)}, or {money(event.entryFeeWithMeal ?? event.entryFee)} with a meal.</p>
            <Link href="/tournaments/#register" className="btn btn-dark">Sign up for a tournament</Link>
          </div>
          <ul className={a.favs}>
            {club.favorites.map((f) => (
              <li key={f.title}>
                <strong>{f.title}</strong>
                <span>{f.body}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  )
}
