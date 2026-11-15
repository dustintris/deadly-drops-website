import type { Metadata } from 'next'
import Link from 'next/link'
import { EntriesCard } from '@/components/EntriesCard'
import { eventTags, LadderBoard } from '@/components/EventBits'
import { PageHero } from '@/components/PageHero'
import { RegistrationForm } from '@/components/RegistrationForm'
import { SeasonList } from '@/components/SeasonList'
import t from '@/components/tournaments.module.css'
import { getBracket, getChampions, getDivisionGuide, getEvents, getLadder, getNextEvent } from '@/lib/data'
import { eventCta, eventEyebrow, eventState } from '@/lib/events'
import { pageMeta } from '@/lib/seo'

export const metadata: Metadata = pageMeta('Tournaments', 'Dominate Charity 2026 in Chula Vista: $55 entry or $65 with a meal, tournament shirt included, round robin into a medal round, $100 gold prize.', '/tournaments/')

export default async function TournamentsPage() {
  const [event, events, guide, bracket, champions, ladder] = await Promise.all([
    getNextEvent(), getEvents(), getDivisionGuide(), getBracket(), getChampions(), getLadder(),
  ])

  const state = eventState(event)
  const cta = eventCta(event, state)
  // from the club's own tournament pages
  const weekend = [
    { title: 'Matched by age and DUPR', body: 'We design our tournaments around age brackets and DUPR levels so everyone plays with peers who match their pace, experience, and stamina.' },
    { title: 'Round robin', body: 'Our round-robin format ensures plenty of playing time for every participant. Medals go to each division’s podium.' },
    { title: 'Charity first', body: 'The focus is on fun, friendly games rather than high-pressure semifinals: a great first taste of competitive play.' },
    { title: 'Courtside Fuel', body: 'Every registration includes a meal and a tournament shirt, with raffle prizes to add to the excitement.' },
  ]

  return (
    <>
      <PageHero
        eyebrow={eventEyebrow(state)}
        title={event.name}
        lede={event.summary}
        photo={event.image?.src ?? '/images/club/dominate-podium-1.jpg'}
        photoPosition={event.image?.position ?? '50% 40%'}
        aside={<EntriesCard event={event} />}
      >
        <p className={t.heroWhen}>{event.dateLabel}</p>
        <ul className="chips" style={{ listStyle: 'none', padding: 0 }}>
          {eventTags(event).map((x) => <li key={x} className="tag">{x}</li>)}
        </ul>
        {event.location && <p className="small muted">{event.location}</p>}
        {cta.external ? (
          <a href={cta.href} className="btn btn-accent" target="_blank" rel="noopener noreferrer">{cta.label} <span className="sr">(opens in a new tab)</span></a>
        ) : (
          <Link href={state === 'open' ? '#register' : cta.href} className="btn btn-accent">{cta.label}</Link>
        )}
      </PageHero>

      <section className="section dark">
        <div className="wrap">
          <SeasonList events={events} champions={champions} />
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

      <section className="section darker">
        <div className="wrap">
          <div className="head-row">
            <p className="eyebrow"><span className="live-dot" /> Gold bracket · 3.5 mixed</p>
            <p className="mono small muted">Semifinals complete</p>
          </div>
          <div className={t.bracket}>
            {bracket.map((round) => (
              <div key={round.label}>
                <p className="label">{round.label}</p>
                <ul>
                  {round.matches.map((m, i) => (
                    <li key={i} data-final={round.label === 'Final'}>
                      <span data-win={m.winner === 'a'}>{m.a}<b>{m.aScore}</b></span>
                      <span data-win={m.winner === 'b'}>{m.b}<b>{m.bScore}</b></span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {state === 'open' && !event.registrationUrl && (
        <section className="section light" id="register">
          <div className="wrap">
            <RegistrationForm event={event} />
          </div>
        </section>
      )}

      <section className="dark">
        <div className="wrap" style={{ maxWidth: 760 }}>
          <LadderBoard entries={ladder} />
        </div>
      </section>
    </>
  )
}
