'use client'

import { useState } from 'react'
import styles from './widgets.module.css'

/**
 * Scrolling news band. Items are listed twice so the loop is seamless; screen readers get the list once.
 * A visible pause button stops the motion (WCAG 2.2.2); reduced motion stops it via CSS.
 */
export function Ticker({ items }: { items: string[] }) {
  const [paused, setPaused] = useState(false)
  const row = items.flatMap((t, i) => [
    <span key={`t${i}`}>{t}</span>,
    <span key={`s${i}`} className={styles.tickSep} aria-hidden="true">✦</span>,
  ])
  return (
    <div className={styles.ticker} data-paused={paused}>
      <p className="sr">{items.join('. ')}</p>
      <div className={styles.tickTrack} aria-hidden="true">
        <div>{row}</div>
        <div>{row}</div>
      </div>
      <button className={styles.tickPause} onClick={() => setPaused((p) => !p)} aria-pressed={paused}>
        <span className="sr">{paused ? 'Play news ticker' : 'Pause news ticker'}</span>
        <span aria-hidden="true">{paused ? '▶' : '❚❚'}</span>
      </button>
    </div>
  )
}
