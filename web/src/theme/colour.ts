/**
 * Colour maths for the theme: WCAG 2.x contrast, and the readable shade of a colour that the site derives when a
 * palette's accent is too light (or too dark) to be text on its own ground. Pure functions on "#RRGGBB" strings.
 */

/** The WCAG AA ratio every text colour pair on the site must reach. */
export const READABLE = 4.5

function channels(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

const toHex = (c: number[]) =>
  '#' + c.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('').toUpperCase()

/** "#ED7BAB" → "237 123 171", for rgb(var(--x-rgb) / alpha) */
export const hexToRgb = (hex: string): string => channels(hex).join(' ')

/** Relative luminance (WCAG 2.x), 0 for black to 1 for white. */
export function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((v) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Contrast ratio between two colours, from 1 (same) to 21 (black on white). */
export function contrastRatio(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

function toHsl(hex: string): [number, number, number] {
  const [r, g, b] = channels(hex).map((v) => v / 255)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return [h / 6, s, l]
}

function fromHsl(h: number, s: number, l: number): string {
  const f = (n: number) => {
    const k = (n + h * 12) % 12
    const a = s * Math.min(l, 1 - l)
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
  }
  return toHex([f(0), f(8), f(4)].map((v) => v * 255))
}

/**
 * `colour` as text on every one of `grounds`. Unchanged when it already reads on the first ground (the page), so a
 * palette that passes today keeps exactly its colour. Otherwise the same hue and saturation with the lightness moved
 * towards `text` (darker on a light page, lighter on a night one) until it reads on them all: a pastel pink becomes
 * a deep, still vivid pink rather than a muddy mix. Falls back to `text`, which the theme editor checks on the page.
 */
export function readableOn(colour: string, grounds: string[], text: string): string {
  if (contrastRatio(colour, grounds[0]) >= READABLE) return colour
  const [h, s, l] = toHsl(colour)
  const step = luminance(text) < luminance(grounds[0]) ? -0.005 : 0.005
  for (let i = 1; i <= 200; i++) {
    const next = l + step * i
    if (next < 0 || next > 1) break
    const shade = fromHsl(h, s, next)
    if (grounds.every((g) => contrastRatio(shade, g) >= READABLE)) return shade
  }
  return text
}
