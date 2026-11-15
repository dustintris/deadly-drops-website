'use client'

import { useEffect, useState } from 'react'
import type { ClubEvent } from '@/lib/types'
import { money } from '@/lib/utils'
import styles from './tournaments.module.css'

/** Hero side card: a live countdown once the event has a date, otherwise the prize pool. */
export function EntriesCard({ event }: { event: ClubEvent }) {
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    if (!event.date) return
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(id)
  }, [event.date])

  if (event.date && now !== null) {
    const ms = Math.max(0, new Date(event.date).getTime() - now)
    const parts = [
      [Math.floor(ms / 864e5), 'Days'],
      [Math.floor(ms / 36e5) % 24, 'Hrs'],
      [Math.floor(ms / 6e4) % 60, 'Min'],
    ] as const
    return (
      <div className={`${styles.entries}`}>
        <p className="eyebrow">Entries close in</p>
        <div className={styles.count}>
          {parts.map(([n, l], i) => (
            <div key={l} data-accent={i === 2}><strong>{String(n).padStart(2, '0')}</strong><span>{l}</span></div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={styles.entries}>
      <p className="eyebrow">Prize pool</p>
      <ol className={styles.pool}>
        {event.prizes.map((p) => (
          <li key={p.place} data-place={p.place}><span>{p.place}</span><strong>{money(p.amount)}</strong></li>
        ))}
      </ol>
      <p className={styles.poolNote}>Plus medals for every podium</p>
    </div>
  )
}
