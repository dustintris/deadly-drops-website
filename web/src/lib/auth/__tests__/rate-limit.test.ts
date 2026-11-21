import { describe, expect, it } from 'vitest'
import { addressKey, allowAction, countActions, HashBusyError, recordAction, recordFailure, waitFor, withHashSlot } from '../rate-limit'

const HOUR = 60 * 60 * 1000

describe('action budgets (allowAction)', () => {
  it('allows `max` actions in the window, then refuses without counting the refusals', () => {
    const key = `budget-${Math.random()}`
    for (let i = 0; i < 3; i++) expect(allowAction(key, 3, HOUR)).toBe(true)
    expect(allowAction(key, 3, HOUR)).toBe(false)
    expect(countActions(key, HOUR)).toBe(3)
    expect(allowAction(`${key}-other`, 3, HOUR)).toBe(true)
  })

  it('counts without a limit for recordAction, and reads never create entries', () => {
    const key = `failures-${Math.random()}`
    expect(countActions(key, HOUR)).toBe(0)
    for (let i = 0; i < 5; i++) recordAction(key, HOUR)
    expect(countActions(key, HOUR)).toBe(5)
    expect(countActions(key, 0)).toBe(0) // nothing is younger than no time at all
  })

  it('when full, drops the keys idle longest instead of forgetting every budget', () => {
    const busy = `busy-${Math.random()}`
    const idle = `idle-${Math.random()}`
    allowAction(idle, 100, HOUR)
    allowAction(busy, 100, HOUR)
    for (let i = 0; i < 5_000; i++) allowAction(`fill-a-${i}-${Math.random()}`, 100, HOUR)
    allowAction(busy, 100, HOUR) // used again: now among the newest
    for (let i = 0; i < 6_000; i++) allowAction(`fill-b-${i}-${Math.random()}`, 100, HOUR)
    expect(countActions(busy, HOUR)).toBe(2)
    expect(countActions(idle, HOUR)).toBe(0)
  })

  it('counts IPv6 addresses by their /64 and IPv4 as is', () => {
    expect(addressKey('2001:db8:abcd:12:1::5')).toBe('2001:db8:abcd:12::/64')
    expect(addressKey('2001:db8::1')).toBe('2001:db8:0:0::/64')
    expect(addressKey('::ffff:203.0.113.7')).toBe('203.0.113.7')
    expect(addressKey('203.0.113.7')).toBe('203.0.113.7')
  })
})

const tick = () => new Promise((r) => setTimeout(r, 5))

describe('withHashSlot()', () => {
  it('never runs more than two hashes at once, even in a burst', async () => {
    let running = 0
    let peak = 0
    const job = () =>
      withHashSlot(async () => {
        running++
        peak = Math.max(peak, running)
        await tick()
        running--
      })
    await Promise.all(Array.from({ length: 12 }, job))
    expect(peak).toBe(2)
  })

  it('turns new work away when too many are already waiting', async () => {
    const slow = () => withHashSlot(() => new Promise<void>((r) => setTimeout(r, 30)))
    const results = await Promise.allSettled(Array.from({ length: 80 }, slow))
    expect(results.some((r) => r.status === 'rejected' && r.reason instanceof HashBusyError)).toBe(true)
  })
})

describe('login throttling', () => {
  it('blocks an address after 10 failures, separately from email backoff', () => {
    const ip = `ip:test-${Math.random()}`
    for (let i = 0; i < 10; i++) recordFailure(ip)
    expect(waitFor(ip, 'ip')).toBeGreaterThan(0)
  })

  it('keeps an address blocked when random emails flood the email counter', () => {
    const ip = `ip:flood-${Math.random()}`
    for (let i = 0; i < 10; i++) recordFailure(ip)
    for (let i = 0; i < 12_000; i++) recordFailure(`email:spray-${i}@example.com`)
    expect(waitFor(ip, 'ip')).toBeGreaterThan(0)
  })
})
