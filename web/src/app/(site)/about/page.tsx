import type { Metadata } from 'next'
import Link from 'next/link'
import { Monogram } from '@/components/Monogram'
import { PageHero } from '@/components/PageHero'
import a from '@/components/about.module.css'
import { AccentTitle } from '@/components/AccentTitle'
import { getClub, getCommittee, getNextEvent, getPageCopy } from '@/lib/data'
import { eventState } from '@/lib/events'
import { asset, money } from '@/lib/utils'
import { pageMeta } from '@/lib/seo'

export const metadata: Metadata = pageMeta('About us', 'Founded by a retired U.S. Navy combat veteran, Deadly Drops Pickleball is a Chula Vista apparel brand and community hub for players of every level.', '/about/')

export default async function AboutPage() {
  const [club, committee, event, copy] = await Promise.all([getClub(), getCommittee(), getNextEvent(), getPageCopy('about')])

  const stats = [
    { value: 'USN', label: 'Veteran owned', accent: true },
    { value: '24', label: 'Divisions at DOMINATE' },
    { value: '100%', label: '911-free tournament' },
    { value: 'All levels', label: 'Beginners welcome', accent: true },
  ]
  const values = club.aboutPoints ?? []

  return (
    <>
      <PageHero
        eyebrow={copy.eyebrow}
        title={<AccentTitle title={copy.title} />}
        lede={copy.lede}
        photo={copy.heroImage?.src}
        photoPosition={copy.heroImage?.position}
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
            <img src={asset('/images/club/backyard-court-gathering.jpg')} alt="Social play at the backyard court" loading="lazy" />
            <img src={asset('/images/club/courtside-fuel-grill.jpg')} alt="Tournament food on the grill" loading="lazy" />
            <img src={asset('/images/club/toy-drive-celebration.jpg')} alt="Toy drive celebration with the Chula Vista Cadets" loading="lazy" />
          </div>
        </div>
      </section>

      <section className="section dark">
        <div className="wrap">
          <h2 className="display d-m">What we&rsquo;re about</h2>
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
            <h2 className="display d-m">{eventState(event) === 'past' ? 'Latest' : 'Next on court'}: {event.name}</h2>
            <p className="muted">{event.summary} Entry {money(event.entryFee)}{event.entryFeeWithMeal ? `, or ${money(event.entryFeeWithMeal)} with a meal` : ''}.</p>
            <Link href="/tournaments/" className="btn btn-dark">See tournaments</Link>
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
