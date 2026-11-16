'use client'

/**
 * Shows one division at a time on the venue screen, moving on every `seconds`. The slides are
 * server-rendered; a live refresh swaps their content but keeps the slide on show. Pauses while
 * the pointer is over it; ← and → step by hand. Also: a Fullscreen button, and the screen is
 * kept awake where the browser allows it.
 */
import { Children, useEffect, useState } from 'react'
import s from '@/components/display.module.css'

type Props = { seconds: number; labels: string[]; children: React.ReactNode }

export function Rotator({ seconds, labels, children }: Props) {
  const slides = Children.toArray(children)
  const count = slides.length
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const shown = count ? index % count : 0

  useEffect(() => {
    if (count < 2 || paused) return
    const t = setInterval(() => setIndex((i) => (i + 1) % count), seconds * 1000)
    return () => clearInterval(t)
  }, [count, paused, seconds])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setIndex((i) => (i + 1) % Math.max(1, count))
      else if (e.key === 'ArrowLeft') setIndex((i) => (i - 1 + Math.max(1, count)) % Math.max(1, count))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [count])

  if (!count) return null
  return (
    <div className={s.rotator} onPointerEnter={() => setPaused(true)} onPointerLeave={() => setPaused(false)}>
      {slides.map((slide, i) => (
        <div key={i} className={s.slide} hidden={i !== shown} aria-hidden={i !== shown}>
          {slide}
        </div>
      ))}
      {count > 1 && (
        <ol className={s.dots} aria-label="Divisions on this screen">
          {labels.map((label, i) => (
            <li key={i} data-on={i === shown}>
              <button type="button" onClick={() => setIndex(i)} aria-current={i === shown ? 'true' : undefined}>{label}</button>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

/** Fullscreen toggle; while the page is open the screen is kept from sleeping (Wake Lock, where supported). */
export function ScreenControls() {
  const [full, setFull] = useState(false)
  useEffect(() => {
    const onChange = () => setFull(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onChange)
    let lock: { release: () => Promise<void> } | null = null
    const wake = async () => {
      try {
        const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }
        if (document.visibilityState === 'visible' && nav.wakeLock) lock = await nav.wakeLock.request('screen')
      } catch {
        /* not allowed (battery saver, no permission): the screen may sleep */
      }
    }
    void wake()
    document.addEventListener('visibilitychange', wake)
    return () => {
      document.removeEventListener('fullscreenchange', onChange)
      document.removeEventListener('visibilitychange', wake)
      void lock?.release().catch(() => {})
    }
  }, [])
  const toggle = () => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {})
    else void document.documentElement.requestFullscreen?.().catch(() => {})
  }
  return (
    <button type="button" className={s.control} onClick={toggle} aria-pressed={full}>
      {full ? 'Exit full screen' : 'Full screen'}
    </button>
  )
}

/** The time of day, in the club's time zone (rendered after load, so server and browser never disagree). */
export function Clock() {
  const [now, setNow] = useState<string | null>(null)
  useEffect(() => {
    const tick = () => setNow(new Date().toLocaleTimeString('en-US', { timeZone: 'America/Los_Angeles', hour: 'numeric', minute: '2-digit' }))
    tick()
    const t = setInterval(tick, 15_000)
    return () => clearInterval(t)
  }, [])
  return <p className={s.clock} suppressHydrationWarning>{now ?? ' '}</p>
}
