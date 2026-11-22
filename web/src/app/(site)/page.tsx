import type { Metadata } from 'next'
import Link from 'next/link'
import { LiveRefresh } from '@/components/LiveRefresh'
import { LiveScore } from '@/components/LiveScore'
import live from '@/components/live.module.css'
import { CloudEdge, Sparkles } from '@/components/Sky'
import { Ticker } from '@/components/Ticker'
import page from '@/components/tournament.module.css'
import ts from '@/components/tournaments.module.css'
import { AccentTitle } from '@/components/AccentTitle'
import { Countdown } from '@/components/Countdown'
import { startLabel, tournamentStart } from '@/lib/countdown'
import { charitiesForTournament, charityHref } from '@/lib/charities'
import type { CharityT } from '@/lib/content-schema'
import {
  getCharities, getClub, getEvents, getLiveFeed, getLiveMatch, getNextEvent, getPageCopy, getTicker,
  getTournamentBasics, getTournamentPage, getTournamentsWithPlay,
} from '@/lib/data'
import { eventCta, eventEyebrow, eventState, latestFirst, type EventState } from '@/lib/events'
import { plural } from '@/lib/match/present'
import { FORMAT_LABELS } from '@/lib/tournaments/schema'
import type { ClubEvent } from '@/lib/types'
import { asset, cx, money } from '@/lib/utils'
import s from './home.module.css'
import { pageMeta } from '@/lib/seo'

export const metadata: Metadata = pageMeta(undefined, 'Deadly Drops Pickleball: charity tournaments, social play and a welcoming community for players of every level in Chula Vista, CA.', '/')

type Tournament = NonNullable<Awaited<ReturnType<typeof getTournamentPage>>>

const PAST_SHOWN = 6
const fee = (n: number) => (n === 0 ? 'Free' : money(n))
const tournamentHref = (e: ClubEvent) => `/tournaments/${e.slug}/`
/** "2026-06-13" → ["13", "Jun 2026"], fixed time zone so it never shifts a day. */
function dateParts(iso: string | null): [string, string] {
  if (!iso) return ['–', '']
  const d = new Date(`${iso}T12:00:00Z`)
  return [String(d.getUTCDate()).padStart(2, '0'), d.toLocaleString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })]
}

export default async function Home() {
  const [club, match, feed, event, ticker, copy, events, charities, basics] = await Promise.all([
    getClub(), getLiveMatch(), getLiveFeed(), getNextEvent(), getTicker(), getPageCopy('home'), getEvents(), getCharities(), getTournamentBasics(),
  ])
  const state = event ? eventState(event) : 'tba'
  const cta = event ? eventCta(event, state) : { label: 'Get notified', href: '#join-email', external: false }
  const hero = copy.heroImage ?? { src: '/images/club/dominate-play-1.jpg', alt: '' }

  // worked out on the server so the browser can't disagree about the date
  const states: Record<string, EventState> = Object.fromEntries(events.map((e) => [e.slug, eventState(e)]))
  // the latest first, as on every tournament list
  const upcoming = events.filter((e) => states[e.slug] !== 'past').sort(latestFirst)
  const past = events.filter((e) => states[e.slug] === 'past').sort(latestFirst)
  // the tournaments shown in full: everything coming up, or with nothing coming up the latest one (with its results)
  const featured = upcoming.length ? upcoming : past.slice(0, 1)
  const pastList = (upcoming.length ? past : past.slice(1)).slice(0, PAST_SHOWN)
  const [details, withPlay] = await Promise.all([
    Promise.all(featured.map((e) => getTournamentPage(e.slug))),
    getTournamentsWithPlay(),
  ])
  // teams, a schedule or scores exist for this tournament, so its page has results to show
  const hasResults = (e: ClubEvent) => withPlay.has(Number(e.id))
  const featuredResults = featured.map((e) => states[e.slug] === 'past' && hasResults(e))
  const pastResults = pastList.map(hasResults)
  // the hero counts down to the lead tournament's start (getTournamentPage is cached: no extra query)
  const lead = event && state !== 'past' ? await getTournamentPage(event.slug) : null
  const start = lead ? tournamentStart(lead) : null
  const countdown = lead && start && Date.parse(start.at) > Date.now() ? { ...start, name: lead.name, label: startLabel(start) } : null

  return (
    <>
      <section className={s.hero}>
        <picture>
          {copy.heroImageMobile && <source media="(max-width: 720px)" srcSet={asset(copy.heroImageMobile.src)} />}
          <img className={s.heroImg} src={asset(hero.src)} alt={hero.alt} style={{ objectPosition: hero.position, transformOrigin: hero.position }} fetchPriority="high" />
        </picture>
        <Sparkles />
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
            {/* on tournament day the page follows the tournament, so the live card updates, appears and goes by itself */}
            {feed && (
              <div className={live.feed}>
                <LiveRefresh tournamentId={feed.tournamentId} version={feed.version} />
              </div>
            )}
          </div>
          {/* a match being played takes the side; until the tournament starts, its countdown does */}
          <div className={s.heroSide}>
            {match ? <LiveScore match={match} /> : countdown && (
              <div className={s.countdownSlot}>
                <Countdown at={countdown.at} timeKnown={countdown.timeKnown} name={countdown.name} label={countdown.label} />
              </div>
            )}
          </div>
        </div>
        <span className={s.scrollCue} aria-hidden="true">Scroll</span>
        {/* pink-white clouds resting on the neon ticker below */}
        <CloudEdge />
      </section>

      <Ticker items={ticker} />

      {/* ---------- tournaments: what's coming up, in full ---------- */}
      <section id="tournaments" className="section dark" aria-labelledby="tournaments-title">
        <div className="wrap">
          {match && (
            <div className={s.mobileScore}>
              <LiveScore match={match} compact />
            </div>
          )}
          <div className="head-row" data-reveal>
            <div className="stack-8">
              <p className="eyebrow">Tournaments</p>
              <h2 id="tournaments-title" className="display d-m">
                {upcoming.length > 1 ? 'Coming up' : upcoming.length ? 'Next up' : featured.length ? 'Our latest tournament' : 'Next tournament coming soon'}
              </h2>
            </div>
            <Link href="/tournaments/" className="link-arrow">All tournaments →</Link>
          </div>

          {featured.length > 0 && (
            <ul className={s.tCards} data-count={featured.length} data-reveal-stagger>
              {featured.map((e, i) => (
                <li key={e.slug}>
                  <TournamentCard e={e} state={states[e.slug]} t={details[i]} charities={charitiesForTournament(charities, e.slug)} results={featuredResults[i]} />
                </li>
              ))}
            </ul>
          )}
          {!upcoming.length && (
            <p className={s.note}>
              The next tournament is announced by email first. <a href="#join-email">Join the list</a> at the bottom of the page to hear the moment registration opens.
            </p>
          )}
        </div>
      </section>

      {/* ---------- how a tournament runs (club content) ---------- */}
      <section className="section light" aria-labelledby="how-title">
        <div className="wrap">
          <div className="head-row" data-reveal>
            <h2 id="how-title" className="display d-m" style={{ maxWidth: '16ch' }}>How our tournaments work</h2>
            <p className="muted small" style={{ maxWidth: '38ch' }}>Play for charity, have fun, make friends, make a difference. Everyone plays with peers at their own pace.</p>
          </div>
          <ol className={ts.weekend} data-reveal-stagger>
            {basics.map((w, i) => (
              <li key={w.title} data-variant={i === 0 ? 'dark' : i === basics.length - 1 ? 'accent' : 'card'}>
                <strong className="display">{i + 1}</strong>
                <h3>{w.title}</h3>
                <p>{w.body}</p>
              </li>
            ))}
          </ol>
          <p style={{ marginTop: 20 }} data-reveal><Link href="/tournaments/" className="btn btn-dark">Divisions &amp; format</Link></p>
        </div>
      </section>

      {/* ---------- past tournaments and their results ---------- */}
      {pastList.length > 0 && (
        <section className="section dark" aria-labelledby="past-title">
          <div className="wrap">
            <div className="head-row" data-reveal>
              <div className="stack-8">
                <p className="eyebrow">Results</p>
                <h2 id="past-title" className="display d-m">Past tournaments</h2>
              </div>
              <Link href="/community/" className="link-arrow">Photos &amp; stories →</Link>
            </div>
            <ul className={ts.season} data-reveal-stagger>
              {pastList.map((e, i) => {
                const [day, month] = dateParts(e.date)
                const cause = charitiesForTournament(charities, e.slug)[0]
                return (
                  <li key={e.slug} className="card">
                    <div className={ts.date}><strong>{day}</strong><span>{month}</span></div>
                    <div className={cx(ts.seasonBody, e.logo && page.withBadge)}>
                      {e.logo && <img className={page.logoBadge} src={asset(e.logo.src)} alt="" width={48} height={48} />}
                      <div>
                        <h3><Link href={tournamentHref(e)} className={page.nameLink}>{e.name}</Link></h3>
                        <p>{e.dateLabel}{e.location ? ` · ${e.location.split(',')[0]}` : ''}</p>
                      </div>
                    </div>
                    {/* a past tournament: the cause it played for, never its entry price */}
                    {cause && <span className="tag">For {cause.name}</span>}
                    <Link href={pastResults[i] ? `${tournamentHref(e)}#results` : tournamentHref(e)} className="btn btn-line btn-sm">
                      {pastResults[i] ? 'Results' : 'Details'}<span className="sr"> for {e.name}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        </section>
      )}

      {/* ---------- the charities the tournaments play for ---------- */}
      {charities.length > 0 && (
        <section className={cx('section darker rule-top', s.cause)} aria-labelledby="charity-title">
          <Sparkles />
          <div className={cx('wrap', s.causeInner)}>
            <div className="head-row" data-reveal>
              <div className="stack-8">
                <p className="eyebrow">Charity</p>
                <h2 id="charity-title" className="display d-m">Playing for a cause</h2>
              </div>
              <p className="muted small" style={{ maxWidth: '40ch' }}>Every Deadly Drops tournament is a charity tournament. These are the causes our players play for.</p>
            </div>
            <ul className={s.charities} data-reveal-stagger="zoom">
              {charities.map((c) => <li key={c.id}><CharityCard c={c} events={events} /></li>)}
            </ul>
            <p style={{ marginTop: 24 }}><Link href="/charity/" className="link-arrow">About our charities →</Link></p>
          </div>
          {/* the night sky melts into pink clouds and the blush section below */}
          <CloudEdge />
        </section>
      )}

      {/* ---------- the club ---------- */}
      <section className="section light">
        <div className="wrap">
          <div className="head-row" data-reveal>
            <h2 className="display d-m" style={{ maxWidth: '14ch' }}>From lurker to lineup in three steps</h2>
            <p className="muted small" style={{ maxWidth: '36ch' }}>
              No tryout. Register, we match you to a division that fits, and you play.
            </p>
          </div>
          <ol className={s.steps} data-reveal-stagger>
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
    </>
  )
}

/** One tournament in full: when, where, entry and what's included, divisions, charity, and the next step. */
function TournamentCard({ e, state, t, charities, results }: { e: ClubEvent; state: EventState; t: Tournament | null; charities: CharityT[]; results: boolean }) {
  const cta = eventCta(e, state)
  const divisions = t?.divisions ?? []
  const formats = [...new Set(divisions.map((d) => FORMAT_LABELS[d.format]))]
  const days = t?.days.length ?? 0
  return (
    <article className={cx('card', s.tCard)}>
      <header className={s.tHead}>
        {e.logo && <img className={page.logoBadgeLg} src={asset(e.logo.src)} alt="" width={72} height={72} />}
        <div className="stack-8">
          <p className="eyebrow">{eventEyebrow(state)}</p>
          <h3 className={cx('display', s.tName)}><Link href={tournamentHref(e)} className={page.titleLink}>{e.name}</Link></h3>
          <p className={s.when}>{e.dateLabel}</p>
        </div>
      </header>
      <p className={s.tSummary}>{e.summary}</p>

      <dl className={s.facts}>
        {e.location && <div className={s.wide}><dt>Where</dt><dd>{e.location}</dd></div>}
        {/* the price only while the tournament is ahead */}
        {state !== 'past' && (
          <div>
            <dt>Entry</dt>
            <dd>{fee(e.entryFee)} per player{e.entryFeeWithMeal !== undefined ? `, ${money(e.entryFeeWithMeal)} with meal` : ''}</dd>
          </div>
        )}
        <div>
          <dt>Divisions</dt>
          <dd>
            {divisions.length ? `${plural(divisions.length, 'division')}${days > 1 ? ` over ${days} days` : ''}` : 'To be announced'}
            {formats.length > 0 && <span className={s.sub}>{formats.join(', ')}</span>}
          </dd>
        </div>
        <div className={s.wide}><dt>Format</dt><dd>{e.format}</dd></div>
        {charities.length > 0 && (
          <div className={s.wide}>
            <dt>Playing for</dt>
            <dd>
              {charities.map((c, k) => (
                <span key={c.id}>{k > 0 && ' & '}<Link href={charityHref(c)} className={page.nameLink}>{c.name}</Link></span>
              ))}
            </dd>
          </div>
        )}
      </dl>

      {e.includes.length > 0 && (
        <div className={s.included}>
          <p className="eyebrow">What&rsquo;s included</p>
          <ul className="chips" style={{ listStyle: 'none', padding: 0 }}>
            {e.includes.map((x, k) => <li key={`${k}-${x}`} className="tag">{x}</li>)}
          </ul>
        </div>
      )}
      {e.prizes.length > 0 && (
        <ul className={s.prizes} aria-label="Prizes">
          {e.prizes.map((p) => <li key={p.place} data-place={p.place}><strong>{money(p.amount)}</strong><span>{p.place}</span></li>)}
        </ul>
      )}

      <div className={page.ctaRow}>
        {state === 'past' ? (
          <Link href={results ? `${tournamentHref(e)}#results` : tournamentHref(e)} className="btn btn-accent">
            {results ? 'Results & standings' : 'Tournament details'}<span className="sr"> for {e.name}</span>
          </Link>
        ) : cta.external ? (
          <a href={cta.href} className="btn btn-accent" target="_blank" rel="noopener noreferrer">{cta.label} <span className="sr">for {e.name} (opens in a new tab)</span></a>
        ) : (
          <Link href={cta.href} className="btn btn-accent">{cta.label}<span className="sr"> for {e.name}</span></Link>
        )}
        {state === 'past' ? (
          <Link href="/community/" className="link-arrow">Photos &amp; stories →</Link>
        ) : (
          <Link href={tournamentHref(e)} className="link-arrow">Schedule &amp; rules →<span className="sr"> for {e.name}</span></Link>
        )}
      </div>
    </article>
  )
}

/** A charity on the home page: its logo (or flyer), summary, the tournament it's tied to, and a link to its full story. */
function CharityCard({ c, events }: { c: CharityT; events: ClubEvent[] }) {
  const img = c.logo ?? c.flyer
  const tied = events.filter((e) => c.tournaments.includes(e.slug))
  return (
    <article className={cx('card', s.charity)} data-img={img ? (c.logo ? 'logo' : 'flyer') : 'none'}>
      {img && (
        <div className={s.charityImg}>
          <img src={asset(img.src)} alt={img.alt || `${c.name} ${c.logo ? 'logo' : 'flyer'}`} loading="lazy" decoding="async" style={{ objectPosition: img.position }} />
        </div>
      )}
      <div className={s.charityBody}>
        <h3 className={s.charityName}>{c.name}</h3>
        {c.tagline && <p className={s.charityTagline}>{c.tagline}</p>}
        <p className={s.charitySummary}>{c.summary}</p>
        {tied.length > 0 && (
          <p className={s.charityFor}>
            <span className="eyebrow">Supported by</span>{' '}
            {tied.map((e, k) => (
              <span key={e.slug}>{k > 0 && ' & '}<Link href={tournamentHref(e)} className={page.nameLink}>{e.name}</Link> <span className={s.sub}>({e.dateLabel})</span></span>
            ))}
          </p>
        )}
        <Link href={charityHref(c)} className="link-arrow">Read more →<span className="sr"> about {c.name}</span></Link>
      </div>
    </article>
  )
}
