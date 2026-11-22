const BASE = process.env.NEXT_PUBLIC_BASE_PATH || ''

/** Prefix a /public path with the deploy base path (needed for plain <img> and CSS urls). */
export const asset = (path: string) => `${BASE}${path}`

export const money = (n: number, cents = false) =>
  '$' + (cents ? n.toFixed(2) : Number.isInteger(n) ? String(n) : n.toFixed(2))

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

/** Two letters for a tile when there's no picture: "Chula Vista Brewing" → "CV", "Acme" → "AC", nothing → "?". */
export function initials(name: string): string {
  const [first, second] = name.match(/[\p{L}\p{N}]+/gu) ?? []
  if (!first) return '?'
  return (second ? first.charAt(0) + second.charAt(0) : first.slice(0, 2)).toUpperCase()
}
