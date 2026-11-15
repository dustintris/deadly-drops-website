import type { Metadata } from 'next'
import Link from 'next/link'
import { LiveScore } from '@/components/LiveScore'
import { Monogram } from '@/components/Monogram'
import { Spotlight } from '@/components/Spotlight'
import { Ticker } from '@/components/Ticker'
import { NextEventBlock, LadderBoard } from '@/components/EventBits'
import { AccentTitle } from '@/components/AccentTitle'
import { getClub, getLadder, getLiveMatch, getMemberCount, getMembers, getNextEvent, getPageCopy, getSpotlights, getTicker } from '@/lib/data'
import { eventCta, eventState } from '@/lib/events'
import { asset } from '@/lib/utils'
import s from './home.module.css'
import { pageMeta } from '@/lib/seo'

export const metadata: Metadata = pageMeta(undefined, 'Deadly Drops Pickleball: charity tournaments, social play and a welcoming community for players of every level in Chula Vista, CA.', '/')

export default async function Home() {
  const [club, members, count, live, spotlights, event, ladder, ticker, copy] = await Promise.all([
    getClub(), getMembers(), getMemberCount(), getLiveMatch(), getSpotlights(), getNextEvent(), getLadder(), getTicker(), getPageCopy('home'),
  ])
  const state = event ? eventState(event) : 'tba'
  const cta = event ? eventCta(event, state) : { label: 'Get notified', href: '#join-email', external: false }
  const hero = copy.heroImage ?? { src: '/images/club/dominate-play-1.jpg', alt: '' }
  const roster = members.slice(0, 22)

  return (
    <>
      <section className={s.hero}>
        <picture>
          {copy.heroImageMobile && <source media="(max-width: 720px)" srcSet={asset(copy.heroImageMobile.src)} />}
          <img className={s.heroImg} src={asset(hero.src)} alt={hero.alt} style={{ objectPosition: hero.position }} fetchPriority="high" />
        </picture>
        <div className={`wrap ${s.heroInner}`}>
          <div className={s.heroCopy} data-enter>
            {copy.eyebrow && <p className="eyebrow">{copy.eyebrow}</p>}
            <h1 className="display d-xl"><AccentTitle title={copy.title} /></h1>
            {copy.lede && <p className="lede">{copy.lede}</p>}
            <div className={s.ctas}>
              {cta.external ? (
                <a href={cta.href} className="btn btn-accent" target="_blank" rel="noopener noreferrer">{cta.label} <span className="sr">(opens in a new tab)</span></a>
              ) : (
                <Link href={cta.href} className="btn btn-accent">{state === 'past' ? 'See the community' : cta.label}</Link>
              )}
              <Link href="/tournaments/" className="btn btn-ghost">{state === 'past' ? 'Tournaments' : 'See the next event'}</Link>
            </div>
          </div>
          <div className={s.heroSide}>
            <LiveScore {...live} />
          </div>
        </div>
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
          {event ? <NextEventBlock event={event} /> : (
            <div style={{ paddingBlock: 'clamp(56px, 7vw, 88px)' }} className="stack-16">
              <p className="eyebrow">Tournaments</p>
              <h2 className="display d-l">Next tournament coming soon</h2>
              <p className="lede">New tournaments are announced by email first. Join the list at the bottom of the page.</p>
            </div>
          )}
          <LadderBoard entries={ladder} />
        </div>
      </section>
    </>
  )
}
