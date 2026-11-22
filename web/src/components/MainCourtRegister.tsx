import { latestFirst, type EventState } from '@/lib/events'
import { MAINCOURT_APP_STORE, MAINCOURT_GOOGLE_PLAY, MAINCOURT_HOME } from '@/lib/maincourt'
import type { ClubEvent } from '@/lib/types'
import m from './maincourt.module.css'

/** How to enter on Main Court, in four steps (what its help center describes, nothing more). */
const STEPS: { title: string; body: string; variant: 'dark' | 'card' | 'accent' }[] = [
  { title: 'Get Main Court', body: 'Download the free app for iPhone or Android, or go to maincourt.com. Sign up with your name and mobile number, then set your skill level.', variant: 'dark' },
  { title: 'Open the tournament', body: 'Use the Register button below, or search the tournament’s name under Tournaments on Main Court.', variant: 'card' },
  { title: 'Pick your division', body: 'Tap “Register Now” on the division you want and pay the entry fee by card.', variant: 'card' },
  { title: 'You’re in', body: 'Your entry shows under “My Tournaments” on Main Court. See you on the court!', variant: 'accent' },
]

const APPS = [
  { label: 'App Store', href: MAINCOURT_APP_STORE, className: 'btn btn-dark btn-sm' },
  { label: 'Google Play', href: MAINCOURT_GOOGLE_PLAY, className: 'btn btn-dark btn-sm' },
  { label: 'maincourt.com', href: MAINCOURT_HOME, className: 'btn btn-ghost btn-sm' },
]

/** Each coming tournament's way in: its Main Court page once entries open, else when they will. */
function EventAction({ e, state }: { e: ClubEvent; state: EventState }) {
  if (state === 'open' && e.registrationUrl) {
    return (
      <a href={e.registrationUrl} className="btn btn-accent" target="_blank" rel="noopener noreferrer">
        Register on Main Court<span className="sr"> for {e.name} (opens in a new tab)</span>
      </a>
    )
  }
  if (state === 'open') return <p className="small muted">Registration link coming soon</p>
  if (state === 'upcoming') {
    return (
      <>
        <p className="small">Registration opens soon</p>
        <a href="#join-email" className="link-arrow">Get notified →</a>
      </>
    )
  }
  return <p className="small muted">Date to be announced</p>
}

/**
 * Registration lives on Main Court (maincourt.com and its free app), not on this site: the steps to
 * enter there, the app links, and a Register button for each tournament taking entries. Always rendered,
 * because the header and footer link to /tournaments/#register.
 */
export function MainCourtRegister({ events, states }: { events: ClubEvent[]; states: Record<string, EventState> }) {
  const coming = events
    .map((e) => ({ e, state: states[e.slug] ?? 'tba' }))
    .filter((x) => x.state !== 'past')
    .sort((a, b) => latestFirst(a.e, b.e))

  return (
    <section className="section light" id="register" aria-labelledby="register-title">
      <div className="wrap">
        <div className="head-row" data-reveal>
          <div className="stack-8">
            <p className="eyebrow">Registration</p>
            <h2 id="register-title" className="display d-m">Register on Main Court</h2>
          </div>
          <p className={`muted small ${m.lede}`}>
            Every Deadly Drops tournament takes entries on Main Court. Sign-up, divisions and payment are all there, and it’s free to join.
          </p>
        </div>

        <ol className={m.steps} data-reveal-stagger>
          {STEPS.map((s, i) => (
            <li key={s.title} data-variant={s.variant}>
              <strong className="display">{i + 1}</strong>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </li>
          ))}
        </ol>

        <div className={m.below}>
          <div className="stack-8" data-reveal>
            <h3 className="eyebrow">Get the free app</h3>
            <p className="small muted">For iPhone and Android, or use maincourt.com in your browser.</p>
            <ul className={m.apps}>
              {APPS.map((a) => (
                <li key={a.label}>
                  <a href={a.href} className={a.className} target="_blank" rel="noopener noreferrer">
                    {a.label}<span className="sr"> (opens in a new tab)</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 id="register-events" className="eyebrow">Coming up</h3>
            {coming.length ? (
              <ul className={m.events} aria-labelledby="register-events" data-reveal-stagger>
                {coming.map(({ e, state }) => (
                  <li key={e.slug} className={`card ${m.event}`}>
                    <div className={m.info}>
                      <h4>{e.name}</h4>
                      <p>
                        {e.dateLabel}
                        {e.location ? ` · ${e.location.split(',')[0]}` : ''}
                      </p>
                    </div>
                    <div className={m.action}>
                      <EventAction e={e} state={state} />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={m.none} data-reveal>
                The next tournament will be listed on Main Court. <a href="#join-email">Join the email list</a> to hear the moment registration opens.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
