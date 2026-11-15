'use client'

import { useEffect, useState } from 'react'
import type { Spotlight as SpotlightT } from '@/lib/types'
import { asset } from '@/lib/utils'
import styles from './widgets.module.css'

/** Member spotlight carousel. Rotates every 10s, pauses on hover/focus and under reduced motion. */
export function Spotlight({ items }: { items: SpotlightT[] }) {
  const [i, setI] = useState(0)
  const [paused, setPaused] = useState(false)
  const s = items[i]
  const go = (d: number) => setI((x) => (x + d + items.length) % items.length)

  useEffect(() => {
    if (paused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const id = setTimeout(() => go(1), 10000)
    return () => clearTimeout(id)
  })

  return (
    <div
      className={styles.spot}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div className="head-row">
        <p className="eyebrow">Member spotlight</p>
        <div className={styles.spotArrows}>
          <button onClick={() => go(-1)} aria-label="Previous member">←</button>
          <button onClick={() => go(1)} aria-label="Next member">→</button>
        </div>
      </div>
      <div className={styles.spotGrid} aria-live="polite">
        <div className={`photo ${styles.spotPhoto}`} key={s.slug}>
          <img src={asset(s.photo)} alt="" loading="lazy" style={{ objectPosition: s.photoPosition }} />
          <span className="badge">{s.division}</span>
        </div>
        <div className={styles.spotBody} key={s.slug + '-b'}>
          <h2 className="display d-l">{s.name}</h2>
          <blockquote>“{s.quote}”</blockquote>
          <dl className={styles.spotStats}>
            <div className="stat"><dt className="sr">Rating</dt><dd><strong className="accent">{s.rating.toFixed(2)}</strong><span>Rating</span></dd></div>
            <div className="stat"><dt className="sr">Matches won</dt><dd><strong className="accent">{s.wins}</strong><span>Matches won</span></dd></div>
            <div className="stat"><dt className="sr">Years in club</dt><dd><strong>{s.yearsInClub}</strong><span>Years in club</span></dd></div>
          </dl>
          <div className={styles.dots} role="group" aria-label="Choose member">
            {items.map((m, k) => (
              <button key={m.slug} aria-label={m.name} aria-pressed={k === i} onClick={() => setI(k)} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
