import 'server-only'
import { addressKey } from '@/lib/auth/rate-limit'

/**
 * Throttling for the public Contact form and "Join the list", in memory (one server). Kept apart from the login
 * counters (auth/rate-limit.ts) so a flood of form posts can never push a login block out.
 * - per client address: 5 of each an hour
 * - site-wide: 200 of each an hour, so a botnet can't fill the database or the owner's inbox
 * - bounded: at most 5 000 tracked addresses per form; expired ones go first, then the oldest
 */
const HOUR = 60 * 60 * 1000
export const PER_ADDRESS = 5
export const SITE_WIDE = 200
const MAX_KEYS = 5_000

type Kind = 'contact' | 'signup'
const counters: Record<Kind, Map<string, number[]>> = { contact: new Map(), signup: new Map() }
const site: Record<Kind, number[]> = { contact: [], signup: [] }

const recent = (list: number[] | undefined, now: number) => (list ?? []).filter((t) => now - t < HOUR)

function makeRoom(map: Map<string, number[]>, now: number) {
  for (const [k, list] of map) if (!list.some((t) => now - t < HOUR)) map.delete(k)
  if (map.size < MAX_KEYS) return
  // still full of live entries: drop the oldest (a Map keeps insertion order)
  for (const k of map.keys()) {
    map.delete(k)
    if (map.size < MAX_KEYS * 0.9) break
  }
}

// IPv4 as it is, IPv6 by its /64 network (shared with the desktop app's activation limit)
export { addressKey }

/** True (and counted) when this address may send one more `kind` now; false when it must wait. */
export function allowSubmission(kind: Kind, ip: string, now = Date.now()): boolean {
  const map = counters[kind]
  const address = addressKey(ip)
  const mine = recent(map.get(address), now)
  const all = recent(site[kind], now)
  if (mine.length >= PER_ADDRESS || all.length >= SITE_WIDE) return false
  if (!map.has(address) && map.size >= MAX_KEYS) makeRoom(map, now)
  map.set(address, [...mine, now])
  site[kind] = [...all, now]
  return true
}

/** Tests only: forget every count. */
export function resetSubmissionLimits() {
  for (const k of Object.keys(counters) as Kind[]) {
    counters[k].clear()
    site[k] = []
  }
}
