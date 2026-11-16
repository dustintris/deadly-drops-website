import type { Metadata } from 'next'
import Link from 'next/link'
import { EntriesCard } from '@/components/EntriesCard'
import { eventTags } from '@/components/EventBits'
import live from '@/components/live.module.css'
import { PageHero } from '@/components/PageHero'
import { RegistrationForm } from '@/components/RegistrationForm'
import { SeasonList } from '@/components/SeasonList'
import page from '@/components/tournament.module.css'
import t from '@/components/tournaments.module.css'
import { getChampions, getDivisionGuide, getEvents, getNextEvent, getTournamentLive } from '@/lib/data'
import { clubToday, eventCta, eventEyebrow, eventState } from '@/lib/events'
import { pageMeta } from '@/lib/seo'
import { money } from '@/lib/utils'

export async function generateMetadata(): Promise<Metadata> {
  const e = await getNextEvent()
  const desc = e
    ? `${e.name}, ${e.dateLabel}${e.location ? ` at ${e.location.split(',')[0]}` : ''}. ${money(e.entryFee)} entry. Deadly Drops Pickleball charity tournaments in Chula Vista, CA.`
    : 'Deadly Drops Pickleball charity tournaments in Chula Vista, CA: divisions by age and DUPR level, round robin play, a meal and a shirt with every entry.'
  return pageMeta('Tournaments', desc.slice(0, 160), '/tournaments/')
}

export default async function TournamentsPage() {
  const [event, events, guide, champions] = await Promise.all([getNextEvent(), getEvents(), getDivisionGuide(), getChampions()])

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
  // from the club's own tournament pages
  const weekend = [
    { title: 'Matched by age and DUPR', body: 'We design our tournaments around age brackets and DUPR levels so everyone plays with peers who match their pace, experience, and stamina.' },
    { title: 'Round robin', body: 'Our round-robin format ensures plenty of playing time for every participant. Medals go to each division’s podium.' },
    { title: 'Charity first', body: 'The focus is on fun, friendly games rather than high-pressure semifinals: a great first taste of competitive play.' },
    { title: 'Courtside Fuel', body: 'Every registration includes a meal and a tournament shirt, with raffle prizes to add to the excitement.' },
  ]

  return (
    <>
      {event && cta ? (
        <PageHero
          eyebrow={eventEyebrow(state)}
          title={<Link href={`/tournaments/${event.slug}/`} className={page.titleLink}>{event.name}</Link>}
          lede={event.summary}
          photo={event.image?.src ?? '/images/club/dominate-podium-1.jpg'}
          photoPosition={event.image?.position ?? '50% 40%'}
          aside={<EntriesCard event={event} state={state} />}
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
              <Link href={state === 'open' ? '#register' : cta.href} className="btn btn-accent">{cta.label}</Link>
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
          <div className="head-row">
            <h2 className="display d-m" style={{ maxWidth: '16ch' }}>How a Deadly Drops tournament runs</h2>
            <p className="muted small" style={{ maxWidth: '38ch' }}>Pink, spooky, friendly, community-driven. Play for charity, have fun, make friends, make a difference.</p>
          </div>
          <ol className={t.weekend}>
            {weekend.map((w, i) => (
              <li key={w.title} data-variant={i === 0 ? 'dark' : i === 3 ? 'accent' : 'card'}>
                <strong className="display">{i + 1}</strong>
                <h3>{w.title}</h3>
                <p>{w.body}</p>
              </li>
            ))}
          </ol>
          <ul className={t.divs} aria-label="Divisions">
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
            <div className={`card ${live.latest}`} data-live={resultsLive}>
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

      {event && state === 'open' && !event.registrationUrl && (
        <section className="section light" id="register">
          <div className="wrap">
            <RegistrationForm event={event} />
          </div>
        </section>
      )}
    </>
  )
}
