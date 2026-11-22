import Link from 'next/link'
import type { Champions } from '@/lib/champions'
import type { ClubEvent } from '@/lib/types'
import { eventCta, latestFirst, type EventState } from '@/lib/events'
import { asset, cx, money } from '@/lib/utils'
import l from './live.module.css'
import page from './tournament.module.css'
import styles from './tournaments.module.css'

/**
 * Every visible tournament on one page, the latest first: the ones still to come under their own heading, then the
 * past ones with the latest champions. `champions`: the latest finished tournament's gold medallists from its
 * recorded play, or null (then no champions show).
 */
export function SeasonList({ events, states, champions }: { events: ClubEvent[]; states: Record<string, EventState>; champions: Champions | null }) {
  const withState = events.map((e) => ({ e, st: states[e.slug] ?? 'tba' }))
  const upcoming = withState.filter((x) => x.st !== 'past').sort((a, b) => latestFirst(a.e, b.e))
  const past = withState.filter((x) => x.st === 'past').sort((a, b) => latestFirst(a.e, b.e))
  return (
    <>
      <div className="head-row" data-reveal>
        <div className="stack-8">
          <p className="eyebrow">Coming up</p>
          <h2 className="display d-m">{upcoming.length ? 'Upcoming tournaments' : 'Next tournament coming soon'}</h2>
        </div>
      </div>
      <ul className={styles.season} data-reveal-stagger>
        {upcoming.map(({ e, st }) => {
          const d = e.date ? new Date(`${e.date}T12:00:00`) : null
          const cta = eventCta(e, st)
          return (
            <li key={e.slug} className="card">
              <div className={styles.date}>
                <strong>{d ? String(d.getDate()).padStart(2, '0') : 'TBA'}</strong>
                <span>{d ? d.toLocaleString('en-US', { month: 'short', year: 'numeric' }) : 'Date soon'}</span>
              </div>
              <div className={cx(styles.seasonBody, e.logo && page.withBadge)}>
                {e.logo && <img className={page.logoBadge} src={asset(e.logo.src)} alt="" width={48} height={48} />}
                <div>
                  <h3><Link href={`/tournaments/${e.slug}/`} className={page.nameLink}>{e.name}</Link></h3>
                  <p>{e.format} · {e.includes.join(' · ')}</p>
                </div>
              </div>
              <span className="tag">{money(e.entryFee)}{e.entryFeeWithMeal ? ` / ${money(e.entryFeeWithMeal)}` : ''}</span>
              {cta.external ? (
                <a href={cta.href} className="btn btn-accent btn-sm" target="_blank" rel="noopener noreferrer">{st === 'open' ? 'Register' : cta.label} <span className="sr">for {e.name} on Main Court (opens in a new tab)</span></a>
              ) : (
                <Link href={cta.href} className="btn btn-accent btn-sm">{cta.label}<span className="sr"> for {e.name}</span></Link>
              )}
            </li>
          )
        })}
        {!upcoming.length && <li className={styles.more}>No tournament is scheduled right now.</li>}
        <li className={styles.more}>New tournaments are announced by email. Join the list in the footer to hear first.</li>
      </ul>

      {past.length > 0 && (
        <div className={styles.pastGroup}>
          <div className="head-row" data-reveal>
            <div className="stack-8">
              <p className="eyebrow">Results &amp; photos</p>
              <h2 className="display d-m">Past tournaments</h2>
            </div>
          </div>
          <ul className={styles.season} data-reveal-stagger>
            {past.map(({ e }) => {
              const d = e.date ? new Date(`${e.date}T12:00:00`) : null
              return (
                <li key={e.slug} className="card">
                  <div className={styles.date}>
                    <strong>{d ? String(d.getDate()).padStart(2, '0') : '–'}</strong>
                    <span>{d ? d.toLocaleString('en-US', { month: 'short', year: 'numeric' }) : ''}</span>
                  </div>
                  <div className={cx(styles.seasonBody, e.logo && page.withBadge)}>
                    {e.logo && <img className={page.logoBadge} src={asset(e.logo.src)} alt="" width={48} height={48} />}
                    <div>
                      <h3><Link href={`/tournaments/${e.slug}/`} className={page.nameLink}>{e.name}</Link></h3>
                      <p>{e.dateLabel}{e.location ? ` · ${e.location}` : ''}</p>
                    </div>
                  </div>
                  {/* a tournament that's over shows no entry price, only its top prize */}
                  {e.prizes.length > 0 && <span className="tag">Gold {money(e.prizes[0].amount)}</span>}
                  <Link href="/community/" className="btn btn-line btn-sm">Photos &amp; stories<span className="sr"> from {e.name}</span></Link>
                </li>
              )
            })}
          </ul>
          {champions && (
            <>
              <p className="eyebrow" style={{ margin: '32px 0 12px' }}>Division champions · {champions.tournament}</p>
              <ul className={styles.champs} data-reveal-stagger>
                {champions.winners.map((c) => (
                  <li key={c.divisionId} className="card">
                    {/* the gold medal from the results page's podium */}
                    <div className={l.medal} aria-hidden="true">🥇</div>
                    <div>
                      <p className="eyebrow">{c.division}</p>
                      <strong>{c.team}</strong>
                      {c.players && c.players !== c.team && <span>{c.players}</span>}
                    </div>
                  </li>
                ))}
              </ul>
              <p style={{ marginTop: 16 }}>
                <Link href={`/tournaments/${champions.slug}/#results`} className="link-arrow">All results &amp; standings<span aria-hidden="true">&nbsp;→</span><span className="sr"> for {champions.tournament}</span></Link>
              </p>
            </>
          )}
        </div>
      )}
    </>
  )
}
