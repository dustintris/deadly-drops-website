import 'server-only'

/** In-memory login throttle: 5 failures per key within 15 minutes locks that key for 15 minutes. */
const WINDOW = 15 * 60 * 1000
const LIMIT = 5
const fails = new Map<string, number[]>()

export function isLocked(key: string): boolean {
  const now = Date.now()
  const list = (fails.get(key) ?? []).filter((t) => now - t < WINDOW)
  fails.set(key, list)
  return list.length >= LIMIT
}
export function recordFailure(key: string) {
  fails.set(key, [...(fails.get(key) ?? []), Date.now()])
}
export function clearFailures(key: string) {
  fails.delete(key)
}
