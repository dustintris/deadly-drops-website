'use client'

/**
 * Shows one division at a time on the venue screen, moving on every `seconds`. The slides are
 * server-rendered; a live refresh swaps their content but keeps the slide on show. Pauses while
 * the mouse is moving over it (resumes a few seconds after it stops); ← and → step by hand. Also: a Fullscreen button, and the screen is
 * kept awake where the browser allows it.
 */
import { Children, useEffect, useRef, useState } from 'react'
import s from '@/components/display.module.css'

type Props = { seconds: number; labels: string[]; children: React.ReactNode }

export function Rotator({ seconds, labels, children }: Props) {
  const slides = Children.toArray(children)
  const count = slides.length
  const [index, setIndex] = useState(0)
  /** paused while someone is using a mouse or keyboard on it; a cursor left resting resumes after a few seconds */
  const [paused, setPaused] = useState(false)
  /** bumped on every manual step so the timer starts over for the slide picked */
  const [tick, setTick] = useState(0)
  const idle = useRef<ReturnType<typeof setTimeout> | null>(null)
  const shown = count ? index % count : 0

  const nudge = () => {
    setPaused(true)
    if (idle.current) clearTimeout(idle.current)
    idle.current = setTimeout(() => setPaused(false), 6000)
  }
  useEffect(() => () => { if (idle.current) clearTimeout(idle.current) }, [])

  useEffect(() => {
    if (count < 2 || paused) return
    const t = setInterval(() => setIndex((i) => (i + 1) % count), seconds * 1000)
    return () => clearInterval(t)
  }, [count, paused, seconds, tick])

  const go = (to: (i: number) => number) => {
    setIndex((i) => (to(i) + Math.max(1, count)) % Math.max(1, count))
    setTick((n) => n + 1)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go((i) => i + 1)
      else if (e.key === 'ArrowLeft') go((i) => i - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (!count) return null
  return (
    <div className={s.rotator} onPointerMove={nudge}>
      {slides.map((slide, i) => (
        <div key={i} className={s.slide} hidden={i !== shown} aria-hidden={i !== shown}>
          {slide}
        </div>
      ))}
      {count > 1 && (
        <ol className={s.dots} aria-label="Divisions on this screen">
          {labels.map((label, i) => (
            <li key={i} data-on={i === shown}>
              <button type="button" onClick={() => go(() => i)} aria-current={i === shown ? 'true' : undefined}>{label}</button>
            </li>
          ))}
          {paused && <li className={s.paused} aria-live="polite">Paused</li>}
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
    let cancelled = false
    const wake = async () => {
      try {
        const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }
        if (document.visibilityState !== 'visible' || !nav.wakeLock) return
        const got = await nav.wakeLock.request('screen')
        if (cancelled) void got.release().catch(() => {}) // the page was left while asking
        else lock = got
      } catch {
        /* not allowed (battery saver, no permission): the screen may sleep */
      }
    }
    void wake()
    document.addEventListener('visibilitychange', wake)
    return () => {
      cancelled = true
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
