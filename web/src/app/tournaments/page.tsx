import type { Metadata } from 'next'
import Link from 'next/link'
import { EntriesCard } from '@/components/EntriesCard'
import { eventTags, LadderBoard } from '@/components/EventBits'
import { PageHero } from '@/components/PageHero'
import { RegistrationForm } from '@/components/RegistrationForm'
import { SeasonList } from '@/components/SeasonList'
import t from '@/components/tournaments.module.css'
import { getBracket, getChampions, getDivisionGuide, getEvents, getLadder, getNextEvent } from '@/lib/data'
import { money } from '@/lib/utils'
import { pageMeta } from '@/lib/seo'

export const metadata: Metadata = pageMeta('Tournaments', 'Dominate Charity 2026 in Chula Vista: $55 entry or $65 with a meal, tournament shirt included, round robin into a medal round, $100 gold prize.', '/tournaments/')

export default async function TournamentsPage() {
  const [event, events, guide, bracket, champions, ladder] = await Promise.all([
    getNextEvent(), getEvents(), getDivisionGuide(), getBracket(), getChampions(), getLadder(),
  ])

  const weekend = [
    { title: 'Round robin', body: 'Pools inside your division, so every player gets plenty of games before anyone goes home.' },
    { title: 'Medal round', body: 'The top of each pool plays on for the podium: Gold, Silver and Bronze, with medals for all three.' },
    { title: 'Live scoreboards', body: 'Senior friendly scoreboards on site, so players and the crowd always know the score.' },
    { title: 'Courtside Fuel', body: `Authentic regional tournament meals, prepared fresh. Add one to your entry for ${money((event.entryFeeWithMeal ?? event.entryFee) - event.entryFee)}.` },
  ]

  return (
    <>
      <PageHero
        eyebrow={`Next up · ${event.registrationOpen ? 'registration open' : 'coming soon'}`}
        title={event.name}
        lede={event.summary}
        photo="/images/stand-in/ball-on-blue-court.jpg"
        photoPosition="50% 60%"
        aside={<EntriesCard event={event} />}
      >
        <p className={t.heroWhen}>{event.dateLabel}</p>
        <ul className="chips" style={{ listStyle: 'none', padding: 0 }}>
          {eventTags(event).map((x) => <li key={x} className="tag">{x}</li>)}
        </ul>
        <Link href="#register" className="btn btn-accent">Reserve your spot</Link>
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
            <p className="muted small" style={{ maxWidth: '38ch' }}>Structured play built on sportsmanship, from the first serve to the medal round.</p>
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

      <section className="section light" id="register">
        <div className="wrap">
          <RegistrationForm event={event} />
        </div>
      </section>

      <section className="dark">
        <div className="wrap" style={{ maxWidth: 760 }}>
          <LadderBoard entries={ladder} />
        </div>
      </section>
    </>
  )
}
