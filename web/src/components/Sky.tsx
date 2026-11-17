/**
 * Twilight decoration: four-point sparkles and a cloud edge, drawn here (no artwork, no images).
 * Purely decorative: hidden from assistive tech, no pointer events, absolutely placed inside a
 * `position: relative` parent so they never move the layout. Sparkles twinkle and bob, shooting
 * stars cross and the clouds drift, all only without prefers-reduced-motion. Colours follow the theme tokens. Styles: globals.css (`.sky-*`).
 */

const SPARKLE = 'M12 0C12.9 7.3 16.7 11.1 24 12C16.7 12.9 12.9 16.7 12 24C11.1 16.7 7.3 12.9 0 12C7.3 11.1 11.1 7.3 12 0Z'

type Star = { x: number; y: number; size: number; tone?: 'pink' | 'lilac'; delay: number; wide?: true }

/** Kept to the edges and the top so they sit around, not under, the headline. */
const STARS: Star[] = [
  { x: 2, y: 7, size: 12, delay: 0 },
  { x: 9, y: 70, size: 7, tone: 'pink', delay: 1.4, wide: true },
  { x: 24, y: 7, size: 9, tone: 'lilac', delay: 2.3, wide: true },
  { x: 46, y: 12, size: 6, delay: 0.7, wide: true },
  { x: 61, y: 6, size: 14, tone: 'pink', delay: 1.9 },
  { x: 74, y: 30, size: 8, delay: 2.8, wide: true },
  { x: 86, y: 10, size: 11, tone: 'lilac', delay: 0.4 },
  { x: 95, y: 44, size: 16, tone: 'pink', delay: 1.1 },
  { x: 90, y: 74, size: 7, delay: 2.5, wide: true },
]

/** A field of twinkling, gently bobbing sparkles, faint star dust and the odd shooting star; place it first inside the decorated element. */
export function Sparkles({ className }: { className?: string }) {
  return (
    <span className={className ? `sky-sparkles ${className}` : 'sky-sparkles'} aria-hidden="true">
      {STARS.map((s, i) => (
        <svg key={i} className="sky-sparkle" viewBox="0 0 24 24" focusable="false" data-tone={s.tone} data-wide={s.wide}
          style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.size, height: s.size, animationDelay: `${s.delay}s` }}>
          <path d={SPARKLE} />
        </svg>
      ))}
      <span className="sky-meteor" />
      <span className="sky-meteor" />
    </span>
  )
}

/**
 * A row of neon-rimmed clouds along the bottom edge. Its fill is `--cloud-fill` (default: the panel
 * colour), so it can melt into whatever section follows; set the variable on the parent.
 */
export function CloudEdge({ className }: { className?: string }) {
  return (
    <span className={className ? `sky-clouds ${className}` : 'sky-clouds'} aria-hidden="true">
      <span />
    </span>
  )
}
