'use client'

import { useEffect, useEffectEvent, useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { FocusEvent, KeyboardEvent, PointerEvent, WheelEvent } from 'react'
import { dotWindow, isNeighbour, loadsEagerly, slideAt, wrap } from '@/lib/carousel'
import { MOTION_OFF } from '@/lib/motion-pref'
import type { GalleryItem } from '@/lib/types'
import { asset } from '@/lib/utils'
import styles from './gallery.module.css'

/** Long enough to take in a photo and its caption. Anything that moves for over 5 s needs a Pause (WCAG 2.2.2): it has one. */
const AUTOPLAY_MS = 6000
/** Seven 44 px dots fit a 390 px phone; a longer album shows a window of them that follows along. */
const MAX_DOTS = 7

/* Nothing plays by itself with prefers-reduced-motion or the footer's "Pause animations" switch (the same rule as Motion.tsx). */
const REDUCE = '(prefers-reduced-motion: reduce)'
function subscribeMotion(onChange: () => void) {
  const mq = window.matchMedia(REDUCE)
  mq.addEventListener('change', onChange)
  // the footer switch flips <html data-motion> without a reload
  const mo = new MutationObserver(onChange)
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-motion'] })
  return () => {
    mq.removeEventListener('change', onChange)
    mo.disconnect()
  }
}
const motionOff = () => document.documentElement.dataset.motion === MOTION_OFF || window.matchMedia(REDUCE).matches

/* no slideshow in a background tab: it would only load photos nobody is looking at */
function subscribeVisibility(onChange: () => void) {
  document.addEventListener('visibilitychange', onChange)
  return () => document.removeEventListener('visibilitychange', onChange)
}
const tabHidden = () => document.visibilityState === 'hidden'

/** One slide's width: the track holds the slides side by side, each as wide as the track (exact, unlike clientWidth). */
const slideWidth = (track: HTMLElement, count: number) => (count ? track.scrollWidth / count : 0)

type Props = {
  items: GalleryItem[]
  /** The album on show: picking another starts again from its first photo. */
  album: string
  /** Opens the photo viewer (GalleryGrid's lightbox) at this photo. */
  onOpen: (i: number) => void
  /** True while the photo viewer is open, so nothing moves behind it. */
  held?: boolean
}

/**
 * The gallery's featured photos: one big photo at a time, above the grid, following the album chips.
 *
 * - Swiping is the browser's own (a scroll-snapped track); the buttons, dots and arrow keys scroll it from JS.
 * - It moves on by itself every few seconds, but holds still under the mouse or keyboard focus, stops for
 *   good once the visitor takes over (a swipe, an arrow, a dot, a click) until they press Play, and never
 *   starts with reduced motion, "Pause animations", a hidden tab, or while it's scrolled out of view.
 * - The WAI-ARIA carousel pattern: Pause/Play first, then Previous and Next, then the slides; photos that
 *   aren't on show are inert, so Tab and screen readers only meet the current one.
 */
export function GalleryCarousel({ items, album, onOpen, held = false }: Props) {
  const n = items.length
  const [index, setIndex] = useState(0)
  const [shownAlbum, setShownAlbum] = useState(album)
  // the visitor's choice: on until they press Pause or take over, and it stays off when they change album
  const [playing, setPlaying] = useState(true)
  const [hovered, setHovered] = useState(false)
  const [keyFocus, setKeyFocus] = useState(false)
  const [inView, setInView] = useState(true)
  // the server (and the first paint) assume no motion, so the Pause button never flashes in and out
  const still = useSyncExternalStore(subscribeMotion, motionOff, () => true)
  const tabAway = useSyncExternalStore(subscribeVisibility, tabHidden, () => false)

  const trackId = useId()
  const section = useRef<HTMLElement>(null)
  const track = useRef<HTMLDivElement>(null)
  const dots = useRef<HTMLDivElement>(null)
  const playBtn = useRef<HTMLButtonElement>(null)
  /** Where a button, key or the timer sent the track, while it glides there: the slides it passes aren't a swipe. */
  const heading = useRef<number | null>(null)
  /** After an arrow key on a photo or a dot, focus moves to the new one (the old one is inert by then). */
  const refocus = useRef<'slide' | 'dot' | null>(null)
  const frame = useRef(0)

  // another album: back to its first photo (state set while rendering, so the old index never shows)
  if (shownAlbum !== album) {
    setShownAlbum(album)
    setIndex(0)
  }
  const cur = Math.min(index, Math.max(0, n - 1))
  const many = n > 1
  const canPlay = many && !still
  const rotating = canPlay && playing && !hovered && !keyFocus && !held && !tabAway && inView

  /** Shows photo `to` (wrapping round the ends). A visitor's step also stops the slideshow. */
  function go(to: number, byVisitor: boolean) {
    const el = track.current
    if (!many || !el) return
    const next = wrap(to, n)
    if (byVisitor) setPlaying(false)
    setIndex(next)
    const left = next * slideWidth(el, n)
    // already there: nothing is gliding, so no older target may linger and swallow the next swipe
    if (Math.abs(el.scrollLeft - left) < 1) {
      heading.current = null
      return
    }
    heading.current = next
    el.scrollTo({ left, behavior: isNeighbour(cur, next) && !still ? 'smooth' : 'instant' })
  }

  function open(i: number) {
    setPlaying(false)
    onOpen(i)
  }

  // a swipe: the counter, dots and inert slides follow the track as it passes halfway
  function onScroll() {
    if (frame.current) return
    frame.current = requestAnimationFrame(() => {
      frame.current = 0
      const el = track.current
      if (!el) return
      const at = slideAt(el.scrollLeft, slideWidth(el, n), n)
      if (heading.current !== null) {
        if (at === heading.current) heading.current = null
        return
      }
      if (at !== cur) {
        setPlaying(false)
        // keyboard focus on the photo that just slid away (it turns inert) moves with it to the new one
        if (el.contains(document.activeElement)) refocus.current = 'slide'
        setIndex(at)
      }
    })
  }

  // a glide cut short (where the browser reports it) lets go, and the counter shows where the track stopped
  function onScrollEnd() {
    const el = track.current
    if (!el || heading.current === null) return
    heading.current = null
    const at = slideAt(el.scrollLeft, slideWidth(el, n), n)
    if (at !== cur) setIndex(at)
  }

  // a finger or a sideways trackpad scroll takes over from a glide still under way
  function takeOver() {
    heading.current = null
  }
  function onWheel(e: WheelEvent) {
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) takeOver()
  }

  function onKeyDown(e: KeyboardEvent) {
    if (!many || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    if (!step) return
    e.preventDefault()
    const t = e.target as Node
    refocus.current = dots.current?.contains(t) ? 'dot' : track.current?.contains(t) ? 'slide' : null
    go(cur + step, true)
  }

  // keyboard focus on a photo, an arrow or a dot holds it still; not on Pause/Play, so pressing Play plays
  function onFocus(e: FocusEvent<HTMLElement>) {
    setKeyFocus(e.target !== playBtn.current && e.target.matches(':focus-visible'))
  }
  function onBlur(e: FocusEvent<HTMLElement>) {
    if (!e.currentTarget.contains(e.relatedTarget)) setKeyFocus(false)
  }
  // only a real mouse: a tap also sends pointerenter, and a touch screen has no "leave" to let it go again
  const hover = (on: boolean) => (e: PointerEvent) => {
    if (e.pointerType === 'mouse') setHovered(on)
  }

  // a new album starts from its first photo, before the browser paints or reports a scroll
  useLayoutEffect(() => {
    heading.current = null
    if (track.current) track.current.scrollLeft = 0
  }, [album])

  const advance = useEffectEvent(() => go(cur + 1, false))
  useEffect(() => {
    if (!rotating) return
    const t = window.setTimeout(() => advance(), AUTOPLAY_MS)
    return () => window.clearTimeout(t)
  }, [rotating, cur, album])

  useEffect(() => {
    const where = refocus.current
    if (!where) return
    refocus.current = null
    const box = where === 'dot' ? dots.current : track.current
    // preventScroll: the track is already gliding there, a jump would cut it short
    box?.querySelector<HTMLElement>(`[data-i="${cur}"]`)?.focus({ preventScroll: true })
  }, [cur])

  // a turned phone or a resized window: stay on the same photo
  const realign = useEffectEvent(() => {
    const el = track.current
    if (el) el.scrollTo({ left: cur * slideWidth(el, n), behavior: 'instant' })
  })
  const hasSlides = n > 0
  useEffect(() => {
    const el = track.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => realign())
    ro.observe(el)
    return () => ro.disconnect()
  }, [hasSlides])

  // scrolled down to the grid: the slideshow waits until it's back in view
  useEffect(() => {
    const el = section.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver((entries) => setInView(entries.some((en) => en.isIntersecting)))
    io.observe(el)
    return () => io.disconnect()
  }, [hasSlides])

  useEffect(() => () => cancelAnimationFrame(frame.current), [])

  if (!n) return null
  const shown = items[cur]

  return (
    <section
      ref={section}
      className={styles.carousel}
      aria-roledescription="carousel"
      aria-label="Featured photos"
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      onBlur={onBlur}
    >
      <div className={styles.stage} onPointerEnter={hover(true)} onPointerLeave={hover(false)}>
        {canPlay && (
          <button ref={playBtn} type="button" className={styles.play} onClick={() => {
            // the mouse is on the stage while it presses Play: without this the hover hold would keep it still
            if (!playing) setHovered(false)
            setPlaying((p) => !p)
          }} data-no-burst>
            <span aria-hidden="true">{playing ? '❚❚' : '▶'}</span>
            {playing ? 'Pause' : 'Play'}<span className="sr"> slideshow</span>
          </button>
        )}
        {many && (
          <>
            <button type="button" className={`${styles.nav} ${styles.navPrev}`} onClick={() => go(cur - 1, true)} aria-controls={trackId} aria-label="Previous photo">←</button>
            <button type="button" className={`${styles.nav} ${styles.navNext}`} onClick={() => go(cur + 1, true)} aria-controls={trackId} aria-label="Next photo">→</button>
          </>
        )}

        <div id={trackId} ref={track} className={styles.track} onScroll={onScroll} onScrollEnd={onScrollEnd} onTouchStart={takeOver} onWheel={onWheel}>
          {items.map((g, i) => (
            <div
              key={g.id}
              className={styles.slide}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${n}: ${g.caption}`}
              inert={i !== cur}
            >
              <button type="button" className={styles.slideBtn} data-i={i} onClick={() => open(i)} aria-label={`Open photo: ${g.caption}`}>
                <img
                  src={asset(g.src)}
                  alt=""
                  style={{ objectPosition: g.position }}
                  loading={loadsEagerly(i, cur, n) ? 'eager' : 'lazy'}
                  fetchPriority={i === cur ? 'high' : undefined}
                  decoding="async"
                  draggable={false}
                />
                <span className={styles.slideCap}>
                  <strong>{g.caption}</strong>
                  {g.meta && <small>{g.meta}</small>}
                </span>
              </button>
            </div>
          ))}
        </div>

        {/* the slide's own label and the live line below say this to screen readers */}
        {many && <p className={styles.count} aria-hidden="true">{cur + 1} / {n}</p>}
      </div>

      {many && (
        <div ref={dots} className={styles.dots} role="group" aria-label="Choose a photo">
          {dotWindow(cur, n, MAX_DOTS).map(({ i, edge }) => (
            <button
              key={i}
              type="button"
              className={styles.dot}
              data-i={i}
              data-edge={edge || undefined}
              aria-current={i === cur ? 'true' : undefined}
              // one stop on Tab, then the arrow keys move along
              tabIndex={i === cur ? 0 : -1}
              aria-label={`Show photo ${i + 1}: ${items[i].caption}`}
              onClick={() => go(i, true)}
            />
          ))}
        </div>
      )}

      {/* says where you are after each step, but stays quiet while the slideshow plays by itself */}
      {many && (
        <p className="sr" aria-live={rotating ? 'off' : 'polite'} aria-atomic="true">
          Photo {cur + 1} of {n}: {shown.caption}
        </p>
      )}
    </section>
  )
}
