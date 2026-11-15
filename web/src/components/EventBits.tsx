import Link from 'next/link'
import type { ClubEvent, LadderEntry } from '@/lib/types'
import { money } from '@/lib/utils'
import { Monogram } from './Monogram'
import styles from './events.module.css'

export function eventTags(e: ClubEvent) {
  return [
    `${money(e.entryFee)} / player`,
    e.entryFeeWithMeal ? `${money(e.entryFeeWithMeal)} with meal` : null,
    ...e.includes.slice(0, 1),
  ].filter(Boolean) as string[]
}

export function NextEventBlock({ event }: { event: ClubEvent }) {
  return (
    <div className={styles.next}>
      <p className="eyebrow">Next up · {event.registrationOpen ? 'registration open' : 'coming soon'}</p>
      <h2 className="display d-l">{event.name}</h2>
      <p className={styles.when}>{event.dateLabel}</p>
      <p className="lede">{event.summary}</p>
      <ul className={styles.tags}>
        {eventTags(event).map((t) => <li key={t} className="tag">{t}</li>)}
      </ul>
      <div className={styles.prizeRow}>
        {event.prizes.map((p) => (
          <div key={p.place} data-place={p.place}>
            <strong>{money(p.amount)}</strong>
            <span>{p.place}</span>
          </div>
        ))}
      </div>
      <Link href="/tournaments/#register" className="btn btn-accent">Reserve your spot</Link>
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
