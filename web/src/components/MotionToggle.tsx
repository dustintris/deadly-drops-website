'use client'

import { useState } from 'react'
import { MOTION_COOKIE, MOTION_OFF } from '@/lib/motion-pref'

/**
 * Footer switch that pauses the site's moving decoration (drifting clouds, sparkles, shooting stars,
 * the scroll reveals and click bursts) for visitors who find it distracting (WCAG 2.2.2). Remembered
 * for a year; prefers-reduced-motion already turns it all off without this.
 */
export function MotionToggle({ paused: initial }: { paused: boolean }) {
  const [paused, setPaused] = useState(initial)
  const toggle = () => {
    const next = !paused
    setPaused(next)
    if (next) document.documentElement.dataset.motion = MOTION_OFF
    else delete document.documentElement.dataset.motion
    const secure = location.protocol === 'https:' ? '; Secure' : ''
    document.cookie = `${MOTION_COOKIE}=${next ? MOTION_OFF : ''}; Path=/; Max-Age=${next ? 31536000 : 0}; SameSite=Lax${secure}`
  }
  return (
    <button type="button" className="motion-toggle" aria-pressed={paused} onClick={toggle} data-no-burst>
      <span aria-hidden="true">{paused ? '▶' : '❚❚'}</span> Pause animations
    </button>
  )
}
