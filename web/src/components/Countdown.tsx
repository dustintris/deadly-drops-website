'use client'

import { useSyncExternalStore } from 'react'
import { countdownParts, daysUntil, type CountdownParts } from '@/lib/countdown'
import s from './countdown.module.css'

type Props = {
  /** The start as a UTC instant (ISO), from `tournamentStart`. */
  at: string
  /** false: only the date is known, so only the days are counted (no invented clock time). */
  timeKnown: boolean
  /** Tournament name, for the screen-reader label and the caption. */
  name: string
  /** When it starts in words, from `startLabel`: "Saturday, December 5 at 8:00 AM". */
  label: string
}

/*
 * One shared clock for every countdown on the page. It wakes just after each whole second while
 * something listens and the tab is visible, and stops when the last countdown unmounts.
 */
const listeners = new Set<() => void>()
let timer: ReturnType<typeof setTimeout> | undefined

function schedule() {
  clearTimeout(timer)
  timer = undefined
  if (!listeners.size || document.hidden) return
  timer = setTimeout(() => {
    listeners.forEach((l) => l())
    schedule()
  }, 1000 - (Date.now() % 1000) + 15)
}
function onVisibility() {
  // catch up at once on coming back, then carry on ticking
  if (!document.hidden) listeners.forEach((l) => l())
  schedule()
}
function subscribe(listener: () => void) {
  listeners.add(listener)
  if (listeners.size === 1) document.addEventListener('visibilitychange', onVisibility)
  schedule()
  return () => {
    listeners.delete(listener)
    if (!listeners.size) document.removeEventListener('visibilitychange', onVisibility)
    schedule()
  }
}
// snapshots are whole seconds (or minutes for the days-only count), so React only re-renders when the display can change
const nowBySecond = () => Math.floor(Date.now() / 1000) * 1000
const nowByMinute = () => Math.floor(Date.now() / 60_000) * 60_000
// the server and the hydrating render don't know the viewer's "now": both show the placeholder
const unknownNow = () => null

/** Digits that each slide in when they change (keyed by place and value, so only changed digits remount). */
function Digits({ value }: { value: number | null }) {
  const text = value === null ? '--' : String(value).padStart(2, '0')
  const chars = [...text]
  return (
    <span className={s.value}>
      {chars.map((c, i) => (
        <span key={`${chars.length - i}:${c}`} className={s.digit}>{c}</span>
      ))}
    </span>
  )
}

const unitText = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'}`
/** "25 days, 2 hours and 35 minutes" (no seconds: it's read on request, not ticked). */
function timeLeft(p: CountdownParts): string {
  const parts = [unitText(p.days, 'day'), unitText(p.hours, 'hour'), unitText(p.minutes, 'minute')].filter((x, i) => i === 2 || !x.startsWith('0 '))
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}` : parts[0]
}

/**
 * Live countdown to a tournament's start, for the dark home hero. Renders nothing once the start has
 * passed (the live score card takes over on the day).
 */
export function Countdown({ at, timeKnown, name, label }: Props) {
  const now = useSyncExternalStore(subscribe, timeKnown ? nowBySecond : nowByMinute, unknownNow)
  const target = Date.parse(at)
  if (!Number.isFinite(target) || (now !== null && now >= target)) return null

  const caption = <p className={s.when}>{name} · {label}</p>

  if (!timeKnown) {
    const days = now === null ? null : daysUntil(at, now)
    return (
      <div role="timer" className={s.countdown}>
        <p className={`eyebrow ${s.eyebrow}`}>Countdown</p>
        <div className={`${s.glass} ${s.pill}`}>
          <span aria-hidden="true" className={s.pillInner}>
            <Digits value={days} />
            <span className={s.unit}>{days === 1 ? 'day' : 'days'} to go</span>
          </span>
          {days !== null && <span className="sr">{days} {days === 1 ? 'day' : 'days'} to go</span>}
        </div>
        {caption}
      </div>
    )
  }

  const p = now === null ? null : countdownParts(target - now)
  const tiles: [string, number | null][] = [
    ['Days', p && p.days],
    ['Hrs', p && p.hours],
    ['Min', p && p.minutes],
    ['Sec', p && p.seconds],
  ]
  return (
    <div role="timer" className={s.countdown}>
      <p className={`eyebrow ${s.eyebrow}`}>Starts in</p>
      {/* screen readers get the time left to the minute (a timer is never announced by itself) and the start
          from the caption; the digits change every second, so they're hidden from them */}
      {p && <span className="sr">{timeLeft(p)}</span>}
      <ol className={s.tiles} aria-hidden="true">
        {tiles.map(([unit, value]) => (
          <li key={unit} className={`${s.glass} ${s.tile}`}>
            <Digits value={value} />
            <span className={s.unit}>{unit}</span>
          </li>
        ))}
      </ol>
      {caption}
    </div>
  )
}
