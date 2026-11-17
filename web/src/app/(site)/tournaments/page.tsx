import type { Metadata } from 'next'
import Link from 'next/link'
import { Countdown } from '@/components/Countdown'
import { eventTags } from '@/components/EventBits'
import live from '@/components/live.module.css'
import { MainCourtRegister } from '@/components/MainCourtRegister'
import { PageHero } from '@/components/PageHero'
import { SeasonList } from '@/components/SeasonList'
import page from '@/components/tournament.module.css'
import t from '@/components/tournaments.module.css'
import { startLabel, tournamentStart } from '@/lib/countdown'
import { getChampions, getDivisionGuide, getEvents, getNextEvent, getTournamentBasics, getTournamentLive, getTournamentPage } from '@/lib/data'
import { clubToday, eventCta, eventEyebrow, eventState } from '@/lib/events'
import { pageMeta } from '@/lib/seo'
import { asset, money } from '@/lib/utils'

export async function generateMetadata(): Promise<Metadata> {
  const e = await getNextEvent()
  // the entry price only while the tournament is ahead
  const entry = e && eventState(e) !== 'past' ? ` ${money(e.entryFee)} entry.` : ''
  const desc = e
    ? `${e.name}, ${e.dateLabel}${e.location ? ` at ${e.location.split(',')[0]}` : ''}.${entry} Deadly Drops Pickleball charity tournaments in Chula Vista, CA.`
    : 'Deadly Drops Pickleball charity tournaments in Chula Vista, CA: divisions by age and DUPR level, round robin play, a meal and a shirt with every entry.'
  return pageMeta('Tournaments', desc.slice(0, 160), '/tournaments/')
}

export default async function TournamentsPage() {
  const [event, events, guide, champions, weekend] = await Promise.all([getNextEvent(), getEvents(), getDivisionGuide(), getChampions(), getTournamentBasics()])

  const state = event ? eventState(event) : 'tba'
  const cta = event ? eventCta(event, state) : null
  // worked out here on the server so the browser cannot disagree about the date
  const states = Object.fromEntries(events.map((e) => [e.slug, eventState(e)]))
  // the tournament being played now, else the latest one played, when it has teams or scores to show
  const today = clubToday()
  const latest = events.filter((e) => e.date && e.date <= today).sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))[0]
  const latestPlay = latest?.id ? await getTournamentLive(Number(latest.id)) : null
  const results = latest && latestPlay?.divisions.some((d) => d.teams.length > 0 || d.matches.length > 0) ? latest : null
  const resultsLive = results !== null && states[results.slug] !== 'past'
  // beside the hero (never a price): the countdown to the lead tournament's start, or once it's over, its logo
  const lead = event && state !== 'past' ? await getTournamentPage(event.slug) : null
  const start = lead ? tournamentStart(lead) : null
  const heroSide = lead && start && Date.parse(start.at) > Date.now()
    ? <Countdown at={start.at} timeKnown={start.timeKnown} name={lead.name} label={startLabel(start)} />
    : event?.logo
      ? <img className={page.heroLogo} src={asset(event.logo.src)} alt={event.logo.alt || `${event.name} logo`} width={184} height={184} />
      : undefined

  return (
    <>
      {event && cta ? (
        <PageHero
          eyebrow={eventEyebrow(state)}
          title={<Link href={`/tournaments/${event.slug}/`} className={page.titleLink}>{event.name}</Link>}
          lede={event.summary}
          photo={event.image?.src ?? '/images/club/dominate-podium-1.jpg'}
          photoPosition={event.image?.position ?? '50% 40%'}
          aside={heroSide}
        >
          <p className={t.heroWhen}>{event.dateLabel}</p>
          <ul className="chips" style={{ listStyle: 'none', padding: 0 }}>
            {eventTags(event).map((x) => <li key={x} className="tag">{x}</li>)}
          </ul>
          {event.location && <p className="small muted">{event.location}</p>}
          <div className={page.ctaRow}>
            {cta.external ? (
              <a href={cta.href} className="btn btn-accent" target="_blank" rel="noopener noreferrer">{cta.label} <span className="sr">(opens in a new tab)</span></a>
            ) : (
              <Link href={cta.href} className="btn btn-accent">{cta.label}</Link>
            )}
            <Link href={`/tournaments/${event.slug}/`} className="link-arrow">Schedule &amp; rules →<span className="sr"> for {event.name}</span></Link>
          </div>
        </PageHero>
      ) : (
        <PageHero eyebrow="Tournaments" title="Next tournament coming soon" lede="New tournaments are announced by email first. Join the list at the bottom of the page." photo="/images/club/dominate-podium-1.jpg" />
      )}

      <section className="section dark">
        <div className="wrap">
          <SeasonList events={events} states={states} champions={champions} />
        </div>
      </section>

      <section className="section light">
        <div className="wrap">
          <div className="head-row" data-reveal>
            <h2 className="display d-m" style={{ maxWidth: '16ch' }}>How a Deadly Drops tournament runs</h2>
            <p className="muted small" style={{ maxWidth: '38ch' }}>Pink, spooky, friendly, community-driven. Play for charity, have fun, make friends, make a difference.</p>
          </div>
          <ol className={t.weekend} data-reveal-stagger>
            {weekend.map((w, i) => (
              <li key={w.title} data-variant={i === 0 ? 'dark' : i === 3 ? 'accent' : 'card'}>
                <strong className="display">{i + 1}</strong>
                <h3>{w.title}</h3>
                <p>{w.body}</p>
              </li>
            ))}
          </ol>
          <ul className={t.divs} aria-label="Divisions" data-reveal-stagger>
            {guide.map((d) => (
              <li key={d.division} className="card">
                <strong className="display">{d.division}</strong>
                <span className="eyebrow">{d.label}</span>
                <p>{d.note}</p>
              </li>
            ))}
          </ul>
          <p className="small muted" style={{ marginTop: 16 }}>Divisions follow DUPR ratings so every bracket is fair.</p>
        </div>
      </section>

      {results && (
        <section className="section-tight darker" aria-labelledby="latest-results">
          <div className="wrap">
            <div className={`card ${live.latest}`} data-live={resultsLive} data-reveal>
              <div className="stack-8">
                <p className="eyebrow">
                  {resultsLive ? <><span className="live-dot" aria-hidden="true" /> Playing today</> : 'Latest results'}
                </p>
                <h2 id="latest-results" className="display d-s">{results.name}</h2>
              </div>
              <Link href={`/tournaments/${results.slug}/#results`} className="link-arrow">
                {resultsLive ? 'Live results & standings' : 'Results & standings'} →<span className="sr"> for {results.name}</span>
              </Link>
            </div>
          </div>
        </section>
      )}

      <MainCourtRegister events={events} states={states} />
    </>
  )
}
