import type { Metadata } from 'next'
import Link from 'next/link'
import { LiveScore } from '@/components/LiveScore'
import { Monogram } from '@/components/Monogram'
import { Spotlight } from '@/components/Spotlight'
import { Ticker } from '@/components/Ticker'
import { NextEventBlock, LadderBoard } from '@/components/EventBits'
import { getClub, getLadder, getLiveMatch, getMemberCount, getMembers, getNextEvent, getSpotlights, getTicker } from '@/lib/data'
import { asset } from '@/lib/utils'
import s from './home.module.css'
import { pageMeta } from '@/lib/seo'

export const metadata: Metadata = pageMeta(undefined, 'Pickleball tournaments and community events in Chula Vista, CA. Register for Dominate Charity 2026: $55 entry, cash prizes for the podium.', '/')

export default async function Home() {
  const [club, members, count, live, spotlights, event, ladder, ticker] = await Promise.all([
    getClub(), getMembers(), getMemberCount(), getLiveMatch(), getSpotlights(), getNextEvent(), getLadder(), getTicker(),
  ])
  const roster = members.slice(0, 22)

  return (
    <>
      <section className={s.hero}>
        <picture>
          <source media="(max-width: 720px)" srcSet={asset('/images/stand-in/player-palms.jpg')} />
          <img className={s.heroImg} src={asset('/images/stand-in/net-closeup.jpg')} alt="" fetchPriority="high" />
        </picture>
        <div className={`wrap ${s.heroInner}`}>
          <div className={s.heroCopy} data-enter>
            <p className="eyebrow">Open to all · earned by play</p>
            <h1 className="display d-xl">
              Everybody&rsquo;s welcome. <span className="accent">Nobody</span> coasts.
            </h1>
            <p className="lede">
              Structured tournaments and community events in {club.city}. Bring a paddle and a decent attitude.
              We&rsquo;ll match you to a division that fits.
            </p>
            <div className={s.ctas}>
              <Link href="/tournaments/#register" className="btn btn-accent">Sign up for a tournament</Link>
              <Link href="/tournaments/" className="btn btn-ghost">See the next event</Link>
            </div>
          </div>
          <div className={s.heroSide}>
            <LiveScore {...live} />
          </div>
        </div>
        <span className={s.ball} aria-hidden="true" />
        <span className={s.paddle} aria-hidden="true" />
        <span className={s.scrollCue} aria-hidden="true">Scroll</span>
      </section>

      <Ticker items={ticker} />

      <section className="section darker">
        <div className="wrap">
          <div className="head-row">
            <div className="stack-8">
              <p className="eyebrow">The roster</p>
              <h2 className="display d-m">This is who you&rsquo;d be playing</h2>
            </div>
            <Link href="/members/" className="link-arrow">See all {count} members →</Link>
          </div>
          <ul className={s.roster}>
            {roster.map((m, i) => (
              <li key={m.slug} className={i >= 10 ? s.desktopOnly : undefined}>
                <Link href={`/members/${m.slug}/`} className="card-link">
                  <Monogram member={m} />
                  <span>{m.first}</span>
                </Link>
              </li>
            ))}
          </ul>
          <div className={s.mobileScore}>
            <LiveScore {...live} compact />
          </div>
        </div>
      </section>

      <section className="section light">
        <div className="wrap">
          <div className="head-row">
            <h2 className="display d-m" style={{ maxWidth: '14ch' }}>From lurker to lineup in three steps</h2>
            <p className="muted small" style={{ maxWidth: '36ch' }}>
              No tryout. Register, we match you to a division that fits, and you play.
            </p>
          </div>
          <ol className={s.steps}>
            {club.howItWorks.map((step, i) => (
              <li key={step.title} data-variant={i === 0 ? 'dark' : 'accent'}>
                <strong className="display">{String(i + 1).padStart(2, '0')}</strong>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="section darker">
        <div className="wrap">
          <Spotlight items={spotlights} />
        </div>
      </section>

      <section className="dark rule-top">
        <div className={`wrap ${s.nextGrid}`}>
          <NextEventBlock event={event} />
          <LadderBoard entries={ladder} />
        </div>
      </section>
    </>
  )
}
