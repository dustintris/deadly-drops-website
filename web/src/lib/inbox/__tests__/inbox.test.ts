import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getSql } from '@/db/client'
import { ContactInput, SignupInput } from '../input'
import { addressKey, allowSubmission, PER_ADDRESS, resetSubmissionLimits, SITE_WIDE } from '../limit'
import { addMessage, addSignup, countOpenMessages, countSignups, deleteMessage, deleteSignup, listMessages, listSignups, setHandled, signupsCsv } from '../repo'

// the public actions read the caller's address from the request headers
let forwardedFor = '203.0.113.7'
vi.mock('next/headers', () => ({ headers: async () => new Headers({ 'x-forwarded-for': forwardedFor }) }))
const { joinMailingList, sendContactMessage } = await import('@/app/inbox-actions')

const sql = () => getSql()
const GOOD = { name: '  Cherry  ', email: ' Cherry@Example.COM ', topic: 'Shop order', message: 'Hi! I’d like to buy: Dry Fit T-Shirt.\r\nSize: M' }

beforeEach(async () => {
  await sql()`truncate contact_messages, email_signups restart identity`
  resetSubmissionLimits()
  forwardedFor = '203.0.113.7'
})

describe('what the public forms may send', () => {
  it('tidies a contact message: trimmed name, lower-case email, line breaks kept', () => {
    const r = ContactInput.parse({ ...GOOD, website: '' })
    expect(r).toMatchObject({ name: 'Cherry', email: 'cherry@example.com', topic: 'Shop order', message: 'Hi! I’d like to buy: Dry Fit T-Shirt.\nSize: M' })
  })

  it('refuses an unknown topic, a bad email, a too-short message and control characters in the name', () => {
    const r = ContactInput.safeParse({ name: 'A\u0000\u0007', email: 'not-an-email', topic: 'Lottery', message: 'hi' })
    expect(r.success).toBe(false)
    const fields = r.success ? [] : r.error.issues.map((i) => i.path[0])
    expect(fields).toEqual(expect.arrayContaining(['email', 'topic', 'message']))
    expect(ContactInput.parse({ ...GOOD, name: 'Ch\u0000erry' }).name).toBe('Ch erry')
    expect(SignupInput.safeParse({ email: 'x'.repeat(250) + '@a.co' }).success).toBe(false)
  })

  it('refuses addresses that could add a second recipient to a reply', () => {
    for (const bad of ['a@x.com,evil@y.com', 'a@x.com;evil@y.com', '"a"@x.com', '<a@x.com>', 'a(b)@x.com', 'a\\b@x.com']) {
      expect(SignupInput.safeParse({ email: bad }).success, bad).toBe(false)
    }
    expect(SignupInput.parse({ email: 'first.last+ddp@sub.example.org' }).email).toBe('first.last+ddp@sub.example.org')
  })

  it('drops invisible characters that would make a name or address read as something else', () => {
    const r = ContactInput.parse({ ...GOOD, name: 'Cher\u202eyrr\u200b', email: 'fan\u200b@example.com', message: 'Hello\u2028there, friend' })
    expect(r.name).toBe('Cheryrr')
    expect(r.email).toBe('fan@example.com')
    expect(r.message).toBe('Hellothere, friend')
  })
})

describe('throttling', () => {
  it(`lets one address send ${PER_ADDRESS} an hour, per form`, () => {
    const now = 1_000_000
    for (let i = 0; i < PER_ADDRESS; i++) expect(allowSubmission('contact', 'a', now + i)).toBe(true)
    expect(allowSubmission('contact', 'a', now + 10)).toBe(false)
    // the other form and other addresses are counted separately
    expect(allowSubmission('signup', 'a', now + 10)).toBe(true)
    expect(allowSubmission('contact', 'b', now + 10)).toBe(true)
    // an hour later it's allowed again
    expect(allowSubmission('contact', 'a', now + 60 * 60 * 1000 + 1)).toBe(true)
  })

  it('counts IPv6 visitors by their /64 network, and IPv4 (also IPv4-mapped) as is', () => {
    expect(addressKey('2001:db8:abcd:12:1::5')).toBe('2001:db8:abcd:12::/64')
    expect(addressKey('2001:0db8:abcd:0012:ffff:ffff:ffff:ffff')).toBe('2001:db8:abcd:12::/64')
    expect(addressKey('2001:db8::1')).toBe('2001:db8:0:0::/64')
    expect(addressKey('::ffff:203.0.113.7')).toBe('203.0.113.7')
    expect(addressKey('203.0.113.7')).toBe('203.0.113.7')
    // one machine hopping between addresses in its own /64 shares one allowance
    for (let i = 1; i <= PER_ADDRESS; i++) expect(allowSubmission('contact', `2001:db8:1:2::${i}`, 9_000 + i)).toBe(true)
    expect(allowSubmission('contact', '2001:db8:1:2::ffff', 9_100)).toBe(false)
    expect(allowSubmission('contact', '2001:db8:1:3::1', 9_100)).toBe(true)
  })

  it(`caps the whole site at ${SITE_WIDE} an hour`, () => {
    for (let i = 0; i < SITE_WIDE; i++) expect(allowSubmission('signup', `addr-${i}`, 5_000 + i)).toBe(true)
    expect(allowSubmission('signup', 'one-more', 5_000 + SITE_WIDE)).toBe(false)
  })
})

describe('the inbox store', () => {
  it('keeps messages newest first and tracks which are dealt with', async () => {
    await addMessage(ContactInput.parse(GOOD))
    await addMessage(ContactInput.parse({ ...GOOD, name: 'Danny', topic: 'Tournaments' }))
    const [newest, older] = await listMessages()
    expect([newest.name, older.name]).toEqual(['Danny', 'Cherry'])
    expect(await countOpenMessages()).toBe(2)

    expect(await setHandled(older.id, 'Owner')).toBe(true)
    expect(await countOpenMessages()).toBe(1)
    const handled = (await listMessages()).find((m) => m.id === older.id)!
    expect(handled.handledBy).toBe('Owner')
    expect(handled.handledAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)

    expect(await setHandled(older.id, null)).toBe(true)
    expect(await countOpenMessages()).toBe(2)
    expect(await deleteMessage(older.id)).toBe(true)
    expect(await deleteMessage(older.id)).toBe(false)
    expect(await setHandled(older.id, 'Owner')).toBe(false)
  })

  it('always lists every open message, however many have been dealt with since', async () => {
    await addMessage(ContactInput.parse({ ...GOOD, name: 'Waiting since January' }))
    for (let i = 0; i < 3; i++) await addMessage(ContactInput.parse({ ...GOOD, name: `Answered ${i}` }))
    const answered = (await listMessages()).filter((m) => m.name.startsWith('Answered'))
    for (const m of answered) await setHandled(m.id, 'Owner')
    const list = await listMessages(1) // only the newest dealt-with one, but every open one
    expect(list.map((m) => m.name)).toEqual(['Answered 2', 'Waiting since January'])
  })

  it('lists the newest sign-ups for the page and counts them all', async () => {
    for (const e of ['a@example.com', 'b@example.com', 'c@example.com']) await addSignup(e)
    expect((await listSignups(2)).map((s) => s.email)).toEqual(['c@example.com', 'b@example.com'])
    expect(await listSignups()).toHaveLength(3)
    expect(await countSignups()).toBe(3)
  })

  it('keeps each address on the list once, whatever its capitals', async () => {
    expect(await addSignup('Fan@Example.com')).toBe(true)
    expect(await addSignup('fan@example.com ')).toBe(false)
    const list = await listSignups()
    expect(list.map((s) => s.email)).toEqual(['fan@example.com'])
    expect(await deleteSignup(list[0].id)).toBe(true)
    expect(await listSignups()).toEqual([])
  })

  it('refuses a mixed-case address written around the app (the database checks too)', async () => {
    await expect(sql()`insert into email_signups (email) values ('Fan@Example.com')`).rejects.toThrow()
  })

  it('exports CSV a spreadsheet shows as text, never as a formula', () => {
    const csv = signupsCsv([
      { id: 1, email: 'fan@example.com', createdAt: '2027-01-05T18:30:00.000Z' },
      { id: 2, email: '=hyperlink("x")@evil.example', createdAt: '2027-01-06T00:00:00.000Z' },
    ])
    expect(csv.split('\r\n')).toEqual(['email,signed_up', 'fan@example.com,2027-01-05', `"'=hyperlink(""x"")@evil.example",2027-01-06`, ''])
  })
})

describe('the public form actions', () => {
  it('stores a valid message, and answers field by field when something is wrong', async () => {
    expect(await sendContactMessage(GOOD)).toEqual({ ok: true })
    expect((await listMessages())[0]).toMatchObject({ name: 'Cherry', email: 'cherry@example.com' })
    const bad = await sendContactMessage({ ...GOOD, email: 'nope', message: '' })
    expect(bad.ok).toBe(false)
    expect(Object.keys(bad.errors ?? {})).toEqual(expect.arrayContaining(['email', 'message']))
    // anything that isn't the form's shape is refused too
    expect((await sendContactMessage('drop table')).ok).toBe(false)
    expect((await sendContactMessage(null)).ok).toBe(false)
  })

  it('thanks a bot that filled the hidden field, and keeps nothing', async () => {
    expect(await sendContactMessage({ ...GOOD, website: 'https://spam.example' })).toEqual({ ok: true })
    expect(await joinMailingList({ email: 'bot@spam.example', website: 'x' })).toEqual({ ok: true })
    expect(await listMessages()).toEqual([])
    expect(await listSignups()).toEqual([])
  })

  it('slows down one address that keeps sending', async () => {
    for (let i = 0; i < PER_ADDRESS; i++) expect((await sendContactMessage(GOOD)).ok).toBe(true)
    const r = await sendContactMessage(GOOD)
    expect(r.ok).toBe(false)
    expect(r.message).toMatch(/Too many/)
    forwardedFor = '198.51.100.20'
    expect((await sendContactMessage(GOOD)).ok).toBe(true)
  })

  it('counts junk posts too, so a stream of oversized or invalid ones is cut off before it is checked', async () => {
    const huge = { ...GOOD, message: 'x'.repeat(100_000) }
    for (let i = 0; i < PER_ADDRESS; i++) expect((await sendContactMessage(huge)).ok).toBe(false)
    expect((await sendContactMessage(GOOD)).message).toMatch(/Too many/)
    expect(await listMessages()).toEqual([])
  })

  it('gives the same answer for a new and an existing address on the list', async () => {
    expect(await joinMailingList({ email: 'Fan@Example.com' })).toEqual({ ok: true })
    expect(await joinMailingList({ email: 'fan@example.com' })).toEqual({ ok: true })
    expect((await listSignups()).map((s) => s.email)).toEqual(['fan@example.com'])
  })
})
