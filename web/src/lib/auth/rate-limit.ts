import 'server-only'

/**
 * Login throttling, in memory (one server).
 * - Per client address: 10 failures in 15 minutes blocks that address for the rest of the window.
 * - Per account email: an increasing delay (30 s, 1 min, 2 min … max 15 min) after 5 failures, instead of a hard
 *   lockout, so a stranger who knows the owner's email cannot keep the owner out for long.
 * - Address and email counters are kept apart, so spraying random emails can't push an address's block out.
 * - Bounded: at most 10 000 tracked keys per counter; when full, expired entries go first. Reads never create entries.
 */
const WINDOW = 15 * 60 * 1000
const MAX_KEYS = 10_000
const counters = { ip: new Map<string, number[]>(), other: new Map<string, number[]>() }
const counterFor = (key: string) => (key.startsWith('ip:') ? counters.ip : counters.other)

const recent = (map: Map<string, number[]>, key: string, now: number) => (map.get(key) ?? []).filter((t) => now - t < WINDOW)

/** Milliseconds to wait before the next attempt is allowed (0 = allowed). */
export function waitFor(key: string, kind: 'ip' | 'email'): number {
  const now = Date.now()
  const list = recent(counterFor(key), key, now)
  if (!list.length) return 0
  if (kind === 'ip') return list.length >= 10 ? WINDOW - (now - list[0]) : 0
  if (list.length < 5) return 0
  const delay = Math.min(WINDOW, 30_000 * 2 ** (list.length - 5))
  return Math.max(0, list[list.length - 1] + delay - now)
}

function makeRoom(map: Map<string, number[]>, now: number) {
  for (const [k, list] of map) if (!list.some((t) => now - t < WINDOW)) map.delete(k)
  if (map.size < MAX_KEYS) return
  // still full of live entries: drop the oldest (Map keeps insertion order)
  for (const k of map.keys()) {
    map.delete(k)
    if (map.size < MAX_KEYS * 0.9) break
  }
}

/** Count an attempt against `key`. Login counts every attempt up front and clears on success. */
export function recordFailure(key: string) {
  const now = Date.now()
  const map = counterFor(key)
  if (!map.has(key) && map.size >= MAX_KEYS) makeRoom(map, now)
  map.set(key, [...recent(map, key, now), now].slice(-20))
}

export function clearFailures(key: string) {
  counterFor(key).delete(key)
}

/* ---------- password hashing slots ---------- */

export class HashBusyError extends Error {
  constructor() {
    super('The server is busy. Try again in a moment.')
  }
}

/* At most 2 password hashes at once (scrypt uses ~32 MB each) and at most 50 waiting; beyond that, refuse. */
const MAX_RUNNING = 2
const MAX_WAITING = 50
let running = 0
const waiting: (() => void)[] = []

export async function withHashSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (running >= MAX_RUNNING) {
    if (waiting.length >= MAX_WAITING) throw new HashBusyError()
    // a finishing job hands its slot straight to us (running stays counted), so the cap can't be overshot
    await new Promise<void>((resolve) => waiting.push(resolve))
  } else {
    running++
  }
  try {
    return await fn()
  } finally {
    const next = waiting.shift()
    if (next) next()
    else running--
  }
}

/* ---------- simple per-key action budget ---------- */

const budgets = new Map<string, number[]>()

/** True (and counted) when `key` has done fewer than `max` actions in the last `windowMs`. */
export function allowAction(key: string, max: number, windowMs: number): boolean {
  const now = Date.now()
  const list = (budgets.get(key) ?? []).filter((t) => now - t < windowMs)
  if (list.length >= max) return false
  if (!budgets.has(key) && budgets.size >= MAX_KEYS) budgets.clear()
  budgets.set(key, [...list, now])
  return true
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
