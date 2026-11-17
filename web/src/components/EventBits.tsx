import Link from 'next/link'
import type { ClubEvent, LadderEntry } from '@/lib/types'
import { eventCta, eventEyebrow, eventState } from '@/lib/events'
import { asset, money } from '@/lib/utils'
import { Monogram } from './Monogram'
import styles from './events.module.css'
import page from './tournament.module.css'

/** Chips for a hero: what's included. Never the price (that's in the section under the hero). */
export function eventTags(e: ClubEvent): string[] {
  return e.includes.slice(0, 3)
}

export function NextEventBlock({ event }: { event: ClubEvent }) {
  const state = eventState(event)
  const cta = eventCta(event, state)
  return (
    <div className={styles.next}>
      {event.logo && <img className={page.logoBadgeLg} src={asset(event.logo.src)} alt="" width={72} height={72} />}
      <p className="eyebrow">{eventEyebrow(state)}</p>
      <h2 className="display d-l"><Link href={`/tournaments/${event.slug}/`} className={page.titleLink}>{event.name}</Link></h2>
      <p className={styles.when}>{event.dateLabel}</p>
      <p className="lede">{event.summary}</p>
      <ul className={styles.tags}>
        {eventTags(event).map((t) => <li key={t} className="tag">{t}</li>)}
      </ul>
      {event.location && <p className="small muted">{event.location}</p>}
      {event.prizes.length > 0 && <div className={styles.prizeRow}>
        {event.prizes.map((p) => (
          <div key={p.place} data-place={p.place}>
            <strong>{money(p.amount)}</strong>
            <span>{p.place}</span>
          </div>
        ))}
      </div>}
      <div className={page.ctaRow}>
        {cta.external ? (
          <a href={cta.href} className="btn btn-accent" target="_blank" rel="noopener noreferrer">{cta.label} <span className="sr">(opens in a new tab)</span></a>
        ) : (
          <Link href={cta.href} className="btn btn-accent">{cta.label}</Link>
        )}
        <Link href={`/tournaments/${event.slug}/`} className="link-arrow">Schedule &amp; rules →<span className="sr"> for {event.name}</span></Link>
      </div>
    </div>
  )
}

export function LadderBoard({ entries }: { entries: LadderEntry[] }) {
  const top = entries[0]?.points ?? 1
  return (
    <div className={styles.ladder} id="ladder">
      <p className="eyebrow"><span className="live-dot" /> Season ladder · live</p>
      <ol>
        {entries.map((e) => (
          <li key={e.rank}>
            <Link href={`/members/${e.member.slug}/`}>
              <span className={styles.bar} style={{ width: `${Math.round((e.points / top) * 96)}%` }} aria-hidden="true" />
              <b>{e.rank}</b>
              <Monogram member={e.member} size="sm" round />
              <span className={styles.lname}>{e.member.name}</span>
              <span className={styles.ldiv}>{e.member.division}</span>
              <span className={styles.lpts}>{e.points}</span>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  )
}
