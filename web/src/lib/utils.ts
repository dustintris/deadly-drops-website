const BASE = process.env.NEXT_PUBLIC_BASE_PATH || ''

/** Prefix a /public path with the deploy base path (needed for plain <img> and CSS urls). */
export const asset = (path: string) => `${BASE}${path}`

export const money = (n: number, cents = false) =>
  '$' + (cents ? n.toFixed(2) : Number.isInteger(n) ? String(n) : n.toFixed(2))

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')
