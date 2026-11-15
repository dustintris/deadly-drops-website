'use client'

import { useEffect, useState } from 'react'
import type { Member } from '@/lib/types'
import { Monogram } from './Monogram'
import styles from './widgets.module.css'

type Props = {
  court: string
  division: string
  teamA: { label: string; lead: Member }
  teamB: { label: string; lead: Member }
  startA: number
  startB: number
  compact?: boolean
}

/**
 * Simulated live score for the preview: one rally every few seconds, game to 11.
 * Production: subscribe to the scoreboard feed (WebSocket / SSE) instead.
 */
export function LiveScore({ court, division, teamA, teamB, startA, startB, compact }: Props) {
  const [{ a, b, serving }, setScore] = useState({ a: startA, b: startB, serving: 'a' as 'a' | 'b' })

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const id = setInterval(() => {
      setScore((s) => {
        if (s.a >= 11 || s.b >= 11) return { a: 0, b: 0, serving: 'a' } // game over: next game
        const aWins = Math.random() > 0.5
        return { a: s.a + (aWins ? 1 : 0), b: s.b + (aWins ? 0 : 1), serving: aWins ? 'a' : 'b' }
      })
    }, 3400)
    return () => clearInterval(id)
  }, [])

  return (
    <section className={`${styles.score} ${compact ? styles.scoreCompact : ''}`} aria-label={`Live score on ${court}, game to 11`}>
      <header>
        <span className="eyebrow"><span className="live-dot" /> Live · {court}</span>
        {!compact && <span className={styles.scoreDiv}>{division}</span>}
      </header>
      <div className={styles.scoreRow} data-lead={a >= b}>
        {!compact && <Monogram member={teamA.lead} size="sm" round />}
        <span>{teamA.label}</span>
        <strong>{a}</strong>
      </div>
      <div className={styles.scoreRow} data-lead={b > a}>
        {!compact && <Monogram member={teamB.lead} size="sm" round />}
        <span>{teamB.label}</span>
        <strong>{b}</strong>
      </div>
      {!compact && (
        <footer>Serving: {(serving === 'a' ? teamA.label : teamB.label).toUpperCase()} · Game to 11</footer>
      )}
    </section>
  )
}
