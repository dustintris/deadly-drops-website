'use client'

/**
 * The public site's motion layer (mounted once in the site layout; the admin and projector board don't use it).
 *
 * - Click: a button, chip or arrow link gives a springy press, a neon ring and a burst of sparkles from
 *   where it was tapped (from its middle for a keyboard press). One listener for the whole site.
 * - Scroll: blocks marked `data-reveal` (optional value zoom | left | right), and the children of a
 *   `data-reveal-stagger` list, slide in the first time they scroll into view. Only blocks still below
 *   the fold when the page opens are hidden first, so nothing on screen ever blinks; whatever reaches the
 *   screen together arrives one after another.
 *
 * With prefers-reduced-motion, or without JavaScript, none of this runs and every block is simply there.
 * Styles: globals.css (`.fx-*`, `[data-reveal-state]`).
 */
import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { MOTION_OFF } from '@/lib/motion-pref'

const CLICKABLE = '.btn, .chip, .link-arrow, button, [role="button"], [data-burst]'
/** Opt out with data-no-burst on the control or a container. */
const OPTED_OUT = ':disabled, [aria-disabled="true"]'
const SPARKS = 10
/** Rapid clicking never piles up more than this many effect elements at once. */
const MAX_FX = 45
const STAGGER_MS = 80
const STAGGER_MAX = 7

/** Motion is off with prefers-reduced-motion, or when the visitor paused it (footer switch, MotionToggle). */
const reducedMotion = () =>
  document.documentElement.dataset.motion === MOTION_OFF || window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Removes an effect element when its animation ends (or is cancelled). */
function removeAfter(node: Element, anim: Animation) {
  anim.onfinish = () => node.remove()
  anim.oncancel = () => node.remove()
}

function burst(layer: HTMLElement, el: HTMLElement, e: MouseEvent) {
  const r = el.getBoundingClientRect()
  // keyboard and assistive-tech clicks have no pointer position: burst from the middle of the control
  const pointer = e.detail > 0 && (e.clientX !== 0 || e.clientY !== 0)
  const x = pointer ? e.clientX : r.left + r.width / 2
  const y = pointer ? e.clientY : r.top + r.height / 2
  // black and deep-pink sparkles on the blush sections, neon ones on the night sky
  const tone = el.closest('.light') ? 'light' : 'dark'

  // the control itself: pressed in, then a little overshoot (`scale` leaves its hover transform alone)
  el.animate([{ scale: '1' }, { scale: '.93', offset: 0.28 }, { scale: '1.05', offset: 0.66 }, { scale: '1' }], {
    duration: 420,
    easing: 'cubic-bezier(.3,.7,.4,1)',
  })

  if (layer.childElementCount > MAX_FX) return

  // a neon ring that leaves the control's outline (not for a keyboard press: it would sit over the focus ring)
  if (pointer && r.width > 0 && r.height > 0) {
    const ring = document.createElement('span')
    ring.className = 'fx-ring'
    ring.dataset.tone = tone
    ring.style.cssText = `left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;border-radius:${getComputedStyle(el).borderRadius}`
    layer.appendChild(ring)
    removeAfter(ring, ring.animate([
      { outlineOffset: '0px', opacity: 0.95 },
      { outlineOffset: '14px', opacity: 0 },
    ], { duration: 560, easing: 'cubic-bezier(.2,.8,.2,1)' }))
  }

  for (let i = 0; i < SPARKS; i++) {
    // the outer span moves and glows, the inner one is cut to the sparkle shape (a mask would clip the glow)
    const spark = document.createElement('span')
    spark.appendChild(document.createElement('span'))
    const size = 14 + Math.random() * 12
    const angle = (i / SPARKS) * Math.PI * 2 + (Math.random() - 0.5) * 0.6
    const dist = 46 + Math.random() * 54
    const dx = Math.cos(angle) * dist
    const dy = Math.sin(angle) * dist
    const spin = (Math.random() - 0.5) * 220
    spark.className = 'fx-spark'
    spark.dataset.tone = tone
    spark.dataset.n = String(i % 3)
    spark.style.cssText = `left:${x - size / 2}px;top:${y - size / 2}px;width:${size}px;height:${size}px`
    layer.appendChild(spark)
    // eased per step (not as a whole), so they burst out fast, sparkle a moment, then fall and fade
    removeAfter(spark, spark.animate([
      { transform: 'translate(0, 0) scale(.2) rotate(0deg)', opacity: 1, easing: 'cubic-bezier(.15,.8,.3,1)' },
      { transform: `translate(${dx * 0.85}px, ${dy * 0.85}px) scale(1.15) rotate(${spin * 0.7}deg)`, opacity: 1, offset: 0.3, easing: 'ease-out' },
      { transform: `translate(${dx}px, ${dy}px) scale(1) rotate(${spin}deg)`, opacity: 1, offset: 0.6, easing: 'ease-in' },
      // then they drift down a little as they fade, like falling glitter
      { transform: `translate(${dx * 1.12}px, ${dy * 1.12 + 18}px) scale(.2) rotate(${spin * 1.5}deg)`, opacity: 0 },
    ], { duration: 720 + Math.random() * 220 }))
  }
}

export function Motion() {
  const layerRef = useRef<HTMLDivElement>(null)
  const pathname = usePathname()

  // ---------- click effect ----------
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const layer = layerRef.current
      const target = e.target instanceof Element ? e.target : null
      const el = target?.closest(CLICKABLE)
      if (!layer || !(el instanceof HTMLElement) || el.matches(OPTED_OUT) || el.closest('[data-no-burst]') || reducedMotion()) return
      burst(layer, el, e)
    }
    // capture: still runs when a control stops the click from bubbling
    document.addEventListener('click', onClick, { capture: true, passive: true })
    return () => document.removeEventListener('click', onClick, { capture: true })
  }, [])

  // ---------- scroll reveal (again on every page) ----------
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined' || reducedMotion()) return
    const main = document.getElementById('main')
    if (!main) return
    const targets = [
      ...main.querySelectorAll<HTMLElement>('[data-reveal]'),
      ...[...main.querySelectorAll<HTMLElement>('[data-reveal-stagger]')].flatMap((list) => [...list.children] as HTMLElement[]),
    ]
    const fold = window.innerHeight * 0.92
    // only what is still below the fold waits; anything already on screen (or scrolled past) stays put
    const waiting = targets.filter((el) => {
      const r = el.getBoundingClientRect()
      return r.height > 0 && r.top > fold
    })
    if (!waiting.length) return

    const settle = (el: HTMLElement) => {
      delete el.dataset.revealState
      el.style.removeProperty('--reveal-delay')
    }
    const onEnd = (ev: AnimationEvent) => {
      // a child's own animation bubbles here too; only the block's reveal counts
      if (ev.target === ev.currentTarget && ev.animationName.startsWith('reveal')) settle(ev.currentTarget as HTMLElement)
    }
    const io = new IntersectionObserver((entries) => {
      // what arrives together comes in one after another, top to bottom, left to right
      const arriving = entries
        .filter((en) => en.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top || a.boundingClientRect.left - b.boundingClientRect.left)
      arriving.forEach((en, i) => {
        const el = en.target as HTMLElement
        io.unobserve(el)
        el.style.setProperty('--reveal-delay', `${Math.min(i, STAGGER_MAX) * STAGGER_MS}ms`)
        el.dataset.revealState = 'in'
      })
    }, { rootMargin: '0px 0px -8% 0px' })

    // keyboard focus can land in a block the scroll didn't bring far enough in: show that block at once
    const onFocus = (ev: FocusEvent) => {
      const block = ev.target instanceof Element ? ev.target.closest<HTMLElement>('[data-reveal-state="wait"]') : null
      if (!block) return
      io.unobserve(block)
      settle(block)
    }

    for (const el of waiting) {
      el.dataset.revealState = 'wait'
      el.addEventListener('animationend', onEnd)
      io.observe(el)
    }
    main.addEventListener('focusin', onFocus)
    return () => {
      main.removeEventListener('focusin', onFocus)
      io.disconnect()
      // leaving the page (or scanning it again): nothing may stay hidden
      for (const el of waiting) {
        el.removeEventListener('animationend', onEnd)
        if (el.dataset.revealState) settle(el)
      }
    }
  }, [pathname])

  return <div ref={layerRef} className="fx-layer" aria-hidden="true" />
}
