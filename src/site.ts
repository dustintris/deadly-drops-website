/** Shared behaviour for the Standard and Premium tiers. */

export const prefersReducedMotion = (): boolean =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Mobile menu: a real button that reports its state, closes on Escape and on link use. */
export function initNav(): void {
  const nav = document.querySelector<HTMLElement>('.site-nav')
  const toggle = nav?.querySelector<HTMLButtonElement>('.nav-toggle')
  if (!nav || !toggle) return

  const setOpen = (open: boolean): void => {
    nav.classList.toggle('open', open)
    toggle.setAttribute('aria-expanded', String(open))
    toggle.textContent = open ? 'Close' : 'Menu'
  }
  toggle.addEventListener('click', () => setOpen(!nav.classList.contains('open')))
  nav.querySelectorAll('.nav-links a').forEach((a) => a.addEventListener('click', () => setOpen(false)))
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && nav.classList.contains('open')) {
      setOpen(false)
      toggle.focus()
    }
  })
}

/**
 * The page's one dealt moment: on the play diagram the ball arcs over the net
 * and drops into the kitchen. Plays once when the diagram first comes into
 * view, and again on "Replay the drop". Reduced motion shows the landed ball.
 */
export function initDropDiagram(): void {
  const svg = document.querySelector<SVGSVGElement>('.play-court')
  const path = document.getElementById('drop-path') as SVGPathElement | null
  const ball = document.getElementById('drop-ball') as SVGCircleElement | null
  const shadow = document.getElementById('drop-shadow') as SVGEllipseElement | null
  const replay = document.getElementById('replay')
  if (!svg || !path || !ball || !shadow) return

  const total = path.getTotalLength()
  const start = path.getPointAtLength(0)
  const end = path.getPointAtLength(total)
  let frame = 0

  const place = (progress: number): void => {
    const point = path.getPointAtLength(progress * total)
    const lift = Math.sin(progress * Math.PI) // 0 at the paddle, 1 at the top of the arc
    ball.setAttribute('cx', String(point.x))
    ball.setAttribute('cy', String(point.y))
    ball.setAttribute('r', String(7 + lift * 4))
    shadow.setAttribute('cx', String(start.x + (end.x - start.x) * progress))
    shadow.setAttribute('cy', String(start.y + 4 + (end.y - start.y) * progress))
    shadow.setAttribute('rx', String(7 - lift * 3))
  }

  const play = (): void => {
    cancelAnimationFrame(frame)
    svg.classList.remove('landed')
    if (prefersReducedMotion()) {
      place(1)
      svg.classList.add('landed')
      return
    }
    const duration = 1400
    const t0 = performance.now()
    const step = (now: number): void => {
      const t = Math.min((now - t0) / duration, 1)
      // ease in-out: slow off the paddle, floats at the top, settles softly
      const eased = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2
      place(eased)
      if (t < 1) frame = requestAnimationFrame(step)
      else svg.classList.add('landed')
    }
    frame = requestAnimationFrame(step)
  }

  place(1) // without JS timing the landed state is what shows
  if (!prefersReducedMotion()) {
    place(0)
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          observer.disconnect()
          play()
        }
      },
      { threshold: 0.5 },
    )
    observer.observe(svg)
  }
  replay?.addEventListener('click', play)
}

export function initSite(): void {
  initNav()
  initDropDiagram()
}
