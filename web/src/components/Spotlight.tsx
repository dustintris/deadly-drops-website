'use client'

import { useEffect, useState } from 'react'
import type { Spotlight as SpotlightT } from '@/lib/types'
import { asset } from '@/lib/utils'
import styles from './widgets.module.css'

/**
 * Member spotlight carousel. Rotates every 10s with a visible pause button (WCAG 2.2.2), also pauses on
 * hover/focus and stays still under reduced motion. Only changes the user makes are announced.
 */
export function Spotlight({ items }: { items: SpotlightT[] }) {
  const [i, setI] = useState(0)
  const [hover, setHover] = useState(false)
  const [stopped, setStopped] = useState(false)
  const [announce, setAnnounce] = useState('')
  const s = items[i]

  const show = (next: number, userAction: boolean) => {
    const k = (next + items.length) % items.length
    setI(k)
    if (userAction) setAnnounce(`${items[k].name}, ${k + 1} of ${items.length}`)
  }

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) setStopped(true)
  }, [])

  useEffect(() => {
    if (stopped || hover) return
    const id = setTimeout(() => setI((x) => (x + 1) % items.length), 10000)
    return () => clearTimeout(id)
  }, [i, stopped, hover, items.length])

  return (
    <div
      className={styles.spot}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocusCapture={() => setHover(true)}
      onBlurCapture={() => setHover(false)}
    >
      <div className="head-row">
        <p className="eyebrow">Member spotlight</p>
        <div className={styles.spotArrows}>
          <button onClick={() => setStopped((x) => !x)} aria-pressed={stopped} aria-label={stopped ? 'Play spotlight' : 'Pause spotlight'}>
            <span aria-hidden="true">{stopped ? '▶' : '❚❚'}</span>
          </button>
          <button onClick={() => show(i - 1, true)} aria-label="Previous member">←</button>
          <button onClick={() => show(i + 1, true)} aria-label="Next member">→</button>
        </div>
      </div>
      <p className="sr" role="status" aria-atomic="true">{announce}</p>
      <div className={styles.spotGrid}>
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
              <button key={m.slug} aria-label={m.name} aria-pressed={k === i} onClick={() => show(k, true)} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
