import type { Metadata } from 'next'
import Link from 'next/link'
import { AccentTitle } from '@/components/AccentTitle'
import { ContactForm } from '@/components/ContactForm'
import { PageHero } from '@/components/PageHero'
import { getClub, getEvents, getPageCopy, getVolunteers } from '@/lib/data'
import { pageMeta } from '@/lib/seo'
import { asset, cx, initials } from '@/lib/utils'
import { comingUp, roleTone } from '@/lib/volunteers'
import v from './volunteers.module.css'

export const metadata: Metadata = pageMeta(
  'Volunteer',
  'Volunteer at Deadly Drops Pickleball charity tournaments in Chula Vista, CA. Check players in, keep score, set up the courts or take photos. Sign up here.',
  '/volunteers/',
)

/** shown in place of the form while sign-ups are closed, if the owner left the note empty */
const CLOSED_NOTE = 'We’re not taking volunteer sign-ups right now. Send us a message and we’ll let you know when the next tournament needs a hand.'

/** "2026-12-05" → { day: '05', month: 'Dec' } for the date tile (noon, so no time zone moves it to another day) */
function dateTile(iso: string | null) {
  if (!iso) return null
  const d = new Date(`${iso}T12:00:00`)
  return { day: String(d.getDate()).padStart(2, '0'), month: d.toLocaleString('en-US', { month: 'short' }) }
}

export default async function VolunteersPage() {
  const [copy, vol, events, club] = await Promise.all([getPageCopy('volunteers'), getVolunteers(), getEvents(), getClub()])
  const { people, roles, perks, signupOpen } = vol
  const note = vol.signupNote.trim()
  // worked out on the server, so the browser can't disagree about which tournaments are over
  const upcoming = comingUp(events)
  const extras = perks.length > 0 || upcoming.length > 0

  return (
    <>
      <PageHero
        eyebrow={copy.eyebrow || undefined}
        title={<AccentTitle title={copy.title} />}
        lede={copy.lede || undefined}
        photo={copy.heroImage?.src}
        photoPosition={copy.heroImage?.position}
      >
        {(signupOpen || people.length > 0 || roles.length > 0) && (
          <div className={v.ctaRow}>
            {signupOpen && <a href="#signup" className="btn btn-accent">Sign up to volunteer</a>}
            {people.length > 0
              ? <a href="#crew" className="link-arrow">Meet our volunteers<span aria-hidden="true">&nbsp;→</span></a>
              : roles.length > 0 && <a href="#roles" className="link-arrow">See the roles<span aria-hidden="true">&nbsp;→</span></a>}
          </div>
        )}
      </PageHero>

      {people.length > 0 && (
        <section id="crew" className="section dark" aria-labelledby="crew-title">
          <div className="wrap">
            <div className="head-row" data-reveal>
              <div className="stack-8">
                <p className="eyebrow">The crew</p>
                <h2 id="crew-title" className="display d-m"><AccentTitle title="Meet our *volunteers*" /></h2>
              </div>
              <p className="muted small" style={{ maxWidth: '38ch' }}>
                The people who check you in, keep score and keep every tournament day running. Thank you, all of you.
              </p>
            </div>
            {/* role="list": Safari drops list semantics from a list with no bullets */}
            <ul className={v.crew} role="list" data-count={people.length} data-reveal-stagger>
              {people.map((p) => (
                <li key={p.id} className={cx('card', v.person)}>
                  <div className={v.portrait} data-photo={!!p.photo}>
                    {p.photo ? (
                      // the name is right below, so an undescribed photo needs no words of its own
                      <img src={asset(p.photo.src)} alt={p.photo.alt} style={{ objectPosition: p.photo.position }} loading="lazy" decoding="async" />
                    ) : (
                      <span className={v.initials} aria-hidden="true">{initials(p.name)}</span>
                    )}
                  </div>
                  <div className={v.personBody}>
                    <h3 className={v.personName}>{p.name}</h3>
                    {p.role && <p className={v.personRole}>{p.role}</p>}
                    {p.bio && <p className={v.personBio}>{p.bio}</p>}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {roles.length > 0 && (
        <section id="roles" className="section light" aria-labelledby="roles-title">
          <div className="wrap">
            <div className="head-row" data-reveal>
              <div className="stack-8">
                <p className="eyebrow">On tournament day</p>
                <h2 id="roles-title" className="display d-m">Ways to help</h2>
              </div>
              <p className="muted small" style={{ maxWidth: '38ch' }}>
                {signupOpen
                  ? 'Pick whatever suits you and say which in your sign-up. We’ll send you the details for the day.'
                  : 'What our volunteers do to keep a tournament day running.'}
              </p>
            </div>
            <ol className={v.roles} data-count={roles.length} data-reveal-stagger>
              {roles.map((r, i) => (
                <li key={r.id} data-tone={roleTone(i)}>
                  {/* the list already numbers the roles for screen readers */}
                  <span className={cx('display', v.num)} aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
                  <h3>{r.title}</h3>
                  <p>{r.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>
      )}

      {extras && (
        <section className="section darker">
          <div className={cx('wrap', v.extras)} data-both={perks.length > 0 && upcoming.length > 0}>
            {perks.length > 0 && (
              <div className={v.perks} data-reveal>
                <p className="eyebrow">For our volunteers</p>
                <h2 className="display d-s">What you get</h2>
                <ul>
                  {perks.map((p, i) => <li key={`${i}-${p}`}>{p}</li>)}
                </ul>
              </div>
            )}
            {upcoming.length > 0 && (
              <div className={cx('stack-16', v.upcoming)}>
                <div className="stack-8" data-reveal>
                  <p className="eyebrow">Tournament days</p>
                  <h2 className="display d-m">Coming up</h2>
                </div>
                <ul className={cx('card', v.dates)} data-reveal-stagger>
                  {upcoming.map((e) => {
                    const tile = dateTile(e.date)
                    return (
                      <li key={e.slug}>
                        <Link href={`/tournaments/${e.slug}/`} className={v.date}>
                          <span className={v.tile} aria-hidden="true">
                            <strong>{tile?.day ?? 'TBA'}</strong>
                            <span>{tile?.month ?? 'Soon'}</span>
                          </span>
                          <span className={v.dateName}>
                            <strong>{e.name}</strong>
                            <span>{e.dateLabel}{e.location ? ` · ${e.location.split(',')[0]}` : ''}</span>
                          </span>
                          <span className={v.arrow} aria-hidden="true">→</span>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
                <Link href="/tournaments/" className="link-arrow">All tournaments<span aria-hidden="true">&nbsp;→</span></Link>
              </div>
            )}
          </div>
        </section>
      )}

      <section id="signup" className={cx('section dark', extras && 'rule-top')} aria-labelledby="signup-title">
        <div className={cx('wrap', v.signup)} data-open={signupOpen}>
          <div className={cx('stack-16', v.intro)} data-reveal>
            <p className="eyebrow">{signupOpen ? 'Sign up' : 'Sign-ups'}</p>
            <h2 id="signup-title" className="display d-m">{signupOpen ? 'Put your name down' : 'Sign-ups are closed for now'}</h2>
            {(note || !signupOpen) && <p className="lede">{note || CLOSED_NOTE}</p>}
            {!signupOpen && (
              <div className={v.ctaRow}>
                <Link href="/contact/?topic=volunteering" className="btn btn-accent">Message us about volunteering</Link>
              </div>
            )}
            <p className="small muted">Rather email? Write to <a href={`mailto:${club.email}`} className={cx('accent', v.mail)}>{club.email}</a>.</p>
          </div>
          {signupOpen && (
            <div className={v.form}>
              <ContactForm email={club.email} topic="Volunteering" hint="Which tournament, and which role would you like? Tell us a little about yourself." />
            </div>
          )}
        </div>
      </section>
    </>
  )
}
