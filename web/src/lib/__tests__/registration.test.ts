import { describe, expect, it } from 'vitest'
import { eventCta } from '../events'
import { isMainCourtUrl } from '../maincourt'
import { Info } from '../tournaments/schema'
import type { ClubEvent } from '../types'

/* All tournament registration is on Main Court: the site only ever sends players there. */

const MC = 'https://maincourt.com/events-list/victory-dink-for-pink-breast-cancer-halloween/'

describe('isMainCourtUrl', () => {
  it('takes https links on maincourt.com and its subdomains', () => {
    expect(isMainCourtUrl(MC)).toBe(true)
    expect(isMainCourtUrl('https://app.maincourt.com/t/123')).toBe(true)
    expect(isMainCourtUrl('https://MAINCOURT.com/x')).toBe(true)
  })

  it('refuses other sites, look-alikes, plain http and links hiding a host', () => {
    expect(isMainCourtUrl('http://maincourt.com/x')).toBe(false)
    expect(isMainCourtUrl('https://maincourt.com.evil.example/x')).toBe(false)
    expect(isMainCourtUrl('https://notmaincourt.com/x')).toBe(false)
    expect(isMainCourtUrl('https://maincourt.com@evil.example/x')).toBe(false)
    expect(isMainCourtUrl('https://user:pass@maincourt.com/x')).toBe(false)
    expect(isMainCourtUrl('not a link')).toBe(false)
  })
})

describe('a tournament’s registration (Admin → Tournaments)', () => {
  const info = {
    summary: 'Our second charity tournament of 2026.',
    dateLabel: 'Oct 17–18, 2026',
    venue: 'Better at Pickleball',
    entryFee: 65,
    includes: ['Tournament shirt'],
    format: 'Round robin',
    prizes: [],
    registrationOpen: false,
  }
  const issues = (v: unknown) => {
    const r = Info.safeParse(v)
    return r.success ? [] : r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
  }

  it('keeps the Main Court link, and lets registration open once it is there', () => {
    expect(issues({ ...info, registrationUrl: MC })).toEqual([])
    expect(issues({ ...info, registrationUrl: MC, registrationOpen: true })).toEqual([])
    expect(issues({ ...info, registrationUrl: '' })).toEqual([]) // closed, no link yet
  })

  it('only takes a Main Court link, with one clear message', () => {
    expect(issues({ ...info, registrationUrl: 'https://forms.example.com/signup' })).toEqual([
      'registrationUrl: Paste the tournament’s Main Court link (https://maincourt.com/…).',
    ])
    expect(issues({ ...info, registrationUrl: 'http://maincourt.com/x' })).toEqual(['registrationUrl: Links must start with https://'])
    expect(issues({ ...info, registrationUrl: 'https://maincourt.com@evil.example/x' })).toHaveLength(1)
  })

  it('cannot open registration without the Main Court link', () => {
    expect(issues({ ...info, registrationOpen: true })).toEqual(['registrationUrl: Add the Main Court link before opening registration.'])
  })
})

describe('eventCta', () => {
  const e: ClubEvent = {
    id: '1', slug: 'victory', name: 'VICTORY', summary: 'x', date: '2099-10-17', dateLabel: 'Oct 17, 2099', entryFee: 65,
    includes: [], format: 'Round robin', prizes: [], registrationOpen: true, registrationUrl: MC,
  } as ClubEvent

  it('sends players to the tournament on Main Court, in a new tab', () => {
    expect(eventCta(e, 'open')).toEqual({ label: 'Register on Main Court', href: MC, external: true })
  })

  it('without a link yet, points to how registration works; otherwise the usual next step', () => {
    expect(eventCta({ ...e, registrationUrl: undefined }, 'open')).toEqual({ label: 'How to register', href: '/tournaments/#register', external: false })
    expect(eventCta(e, 'upcoming').href).toBe('#join-email')
    expect(eventCta(e, 'past').href).toBe('/community/')
  })
})
