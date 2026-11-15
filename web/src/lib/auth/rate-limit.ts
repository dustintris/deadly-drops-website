import 'server-only'

/**
 * Login throttling, in memory (one server).
 * - Per client address: 10 failures in 15 minutes blocks that address for the rest of the window.
 * - Per account email: an increasing delay (30 s, 1 min, 2 min … max 15 min) after 5 failures, instead of a hard
 *   lockout, so a stranger who knows the owner's email cannot keep the owner out for long.
 * - Bounded: at most 10 000 tracked keys; reads never create entries.
 */
const WINDOW = 15 * 60 * 1000
const MAX_KEYS = 10_000
const fails = new Map<string, number[]>()

const recent = (key: string, now: number) => (fails.get(key) ?? []).filter((t) => now - t < WINDOW)

/** Milliseconds to wait before the next attempt is allowed (0 = allowed). */
export function waitFor(key: string, kind: 'ip' | 'email'): number {
  const now = Date.now()
  const list = recent(key, now)
  if (!list.length) return 0
  if (kind === 'ip') return list.length >= 10 ? WINDOW - (now - list[0]) : 0
  if (list.length < 5) return 0
  const delay = Math.min(WINDOW, 30_000 * 2 ** (list.length - 5))
  return Math.max(0, list[list.length - 1] + delay - now)
}

export function recordFailure(key: string) {
  const now = Date.now()
  if (!fails.has(key) && fails.size >= MAX_KEYS) {
    // drop the oldest entries (Map keeps insertion order)
    for (const k of fails.keys()) { fails.delete(k); if (fails.size < MAX_KEYS * 0.9) break }
  }
  fails.set(key, [...recent(key, now), now].slice(-20))
}

export function clearFailures(key: string) {
  fails.delete(key)
}

/* at most 2 password hashes at once (scrypt uses ~32 MB each); extra attempts wait their turn */
let running = 0
const waiting: (() => void)[] = []
export async function withHashSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (running >= 2) await new Promise<void>((res) => waiting.push(res))
  running++
  try {
    return await fn()
  } finally {
    running--
    waiting.shift()?.()
  }
}

/**
 * The client address for throttling. Set CLIENT_IP_HEADER to the header your host sets and clients cannot forge
 * (e.g. fly-client-ip, cf-connecting-ip). Otherwise the right-most X-Forwarded-For entry (added by the nearest proxy).
 */
export function clientIp(h: Headers): string {
  const custom = process.env.CLIENT_IP_HEADER
  if (custom) return (h.get(custom) ?? 'unknown').trim().slice(0, 64)
  const xff = h.get('x-forwarded-for')
  if (xff) return (xff.split(',').pop() ?? '').trim().slice(0, 64) || 'unknown'
  return 'direct'
}
