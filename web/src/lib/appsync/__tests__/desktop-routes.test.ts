import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { getSql } from '@/db/client'
import { normalizePerms } from '@/lib/auth/permissions'
import { resetActions } from '@/lib/auth/rate-limit'
import { createSessionRow } from '@/lib/auth/sessions'
import { createUser } from '@/lib/auth/users'
import { createActivationCode, listInstalls, listOpenCodes, MAX_OPEN_CODES, REVOKED_SHOWN, revokeInstall, TooManyCodesError } from '../installs'
import { revokeAppKey, rotateAppKey } from '../key'

// the staff session is read from the request's cookies (next/headers); server actions revalidate the page
const jar = new Map<string, string>()
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined) }),
  headers: async () => new Headers(),
}))
vi.mock('next/cache', () => ({ revalidatePath: () => {} }))

const { POST: activate } = await import('@/app/api/desktop/activate/route')
const { GET: status } = await import('@/app/api/desktop/status/route')
const { GET: downloadCheck } = await import('@/app/api/desktop/download-check/route')
const { GET: listTournaments } = await import('@/app/api/tournaments/route')
const { GET: oneTournament } = await import('@/app/api/tournaments/[id]/route')
const actions = await import('@/app/admin/desktop-app-actions')

const sql = () => getSql()
const SITE = 'https://ddptournaments.com'
const UNKNOWN = 'DDP-0000-0000-0000'
const INSTALL = '0b6f3a52-9c1e-4d7a-8f00-2d5e6c7b8a91'
const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')
let ipCounter = 0
let ip = ''
let downloads = ''
let warn: ReturnType<typeof vi.spyOn>

beforeAll(async () => {
  downloads = await mkdtemp(path.join(os.tmpdir(), 'ddp-dl-'))
  await mkdir(path.join(downloads, 'desktop'))
  await writeFile(path.join(downloads, 'desktop', 'latest.yml'), 'version: 0.7.2\npath: DeadlyDropsPickleball-Setup-0.7.2.exe\n')
})
afterAll(async () => {
  await rm(downloads, { recursive: true, force: true })
})
beforeEach(async () => {
  await sql()`truncate desktop_activation_codes, desktop_installs, users, sessions, audit_log restart identity cascade`
  await revokeAppKey()
  resetActions() // every test starts with fresh attempt allowances and no site-wide failures
  jar.clear()
  ip = `198.51.100.${++ipCounter}`
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', SITE)
  vi.stubEnv('DOWNLOADS_DIR', downloads)
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  vi.unstubAllEnvs()
  warn.mockRestore()
})

const post = (body: unknown, from = ip) =>
  activate(new Request(`${SITE}/api/desktop/activate/`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': from },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  }))

const body = (code: string, installId = INSTALL, extra: Record<string, unknown> = {}) => ({
  code, installId, deviceName: 'FRONT-DESK-PC', appVersion: '0.7.0', ...extra,
})

const bearer = (key: string, more: Record<string, string> = {}) => ({ authorization: `Bearer ${key}`, ...more })
const getStatus = (headers: Record<string, string>) => status(new Request(`${SITE}/api/desktop/status/`, { headers }))
const check = (uri: string | null, headers: Record<string, string> = {}) =>
  downloadCheck(new Request(`${SITE}/api/desktop/download-check/`, { headers: uri === null ? headers : { 'x-forwarded-uri': uri, ...headers } }))

async function newCode(label = 'Front desk laptop') {
  return (await createActivationCode(label, 'owner@example.com')).code
}

async function activated(label = 'Front desk laptop', installId?: string) {
  const res = await post(body(await newCode(label), installId))
  expect(res.status).toBe(200)
  return (await res.json()) as { key: string; label: string; siteUrl: string }
}

async function staffCookie(perms: Record<string, string>) {
  const u = await createUser({ email: `staff${Math.random().toString(36).slice(2)}@example.com`, name: 'Staff', password: 'a long enough password', perms: normalizePerms(perms) })
  jar.set('dd_admin', await createSessionRow(u.id, 'test', 60 * 60 * 1000))
  return u
}

const firstActive = async () => (await listInstalls()).active[0]

describe('POST /api/desktop/activate/', () => {
  it('trades a code for a key, storing only hashes, and says which computer it is', async () => {
    const code = await newCode('Front desk laptop')
    expect(code).toMatch(/^DDP(-[0-9A-HJKMNP-TV-Z]{4}){3}$/)
    const res = await post(body(code.toLowerCase().replace(/-/g, ' ')))
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('no-store')
    const out = await res.json()
    expect(Object.keys(out).sort()).toEqual(['key', 'label', 'siteUrl'])
    expect(out.key).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(out).toMatchObject({ label: 'Front desk laptop', siteUrl: SITE })

    const [install] = await sql()`select * from desktop_installs`
    expect(install).toMatchObject({ label: 'Front desk laptop', device_name: 'FRONT-DESK-PC', last_version: '0.7.0', created_by: 'owner@example.com', revoked_at: null })
    expect(install.key_hash).toBe(sha256(out.key))
    const [used] = await sql()`select * from desktop_activation_codes`
    expect(used.used_at).not.toBeNull()
    expect(Number(used.install_row_id)).toBe(Number(install.id))
    expect(used.code_hash).not.toBe(sha256(code))
    // the audit log says it happened, without the code or the key
    const log = await sql()`select action, detail from audit_log`
    expect(log.map((r) => r.action)).toContain('desktop_activate')
    for (const r of log) {
      expect(r.detail).not.toContain(out.key)
      expect(r.detail).not.toContain(code)
    }
  })

  it('works once only, and logs each refusal with the address but never the code', async () => {
    const code = await newCode()
    expect((await post(body(code))).status).toBe(200)
    const again = await post(body(code, 'another-computer'))
    expect(again.status).toBe(404)
    expect((await again.json()).message).toMatch(/already been used/)
    expect((await post(body(UNKNOWN))).status).toBe(404)
    const logged = warn.mock.calls.map((c: unknown[]) => c.join(' '))
    expect(logged).toHaveLength(2)
    for (const line of logged) {
      expect(line).toContain(ip)
      expect(line).toMatch(/unknown or used code/)
      expect(line).not.toContain(code)
      expect(line).not.toContain(UNKNOWN)
    }
  })

  it('refuses an expired code with 410', async () => {
    const code = await newCode()
    await sql()`update desktop_activation_codes set created_at = now() - interval '8 days', expires_at = now() - interval '1 day'`
    const res = await post(body(code))
    expect(res.status).toBe(410)
    expect((await res.json()).message).toMatch(/expired/)
    expect(await sql()`select 1 from desktop_installs`).toHaveLength(0)
  })

  it('refuses malformed requests with 400 and a plain message, including old 8-character codes', async () => {
    const code = await newCode()
    for (const bad of [
      'not json',
      {},
      body('DDP-12'),
      body('DDP-7K3M-Q9TX'), // the old length
      body(`${code}-X`),
      body(code, 'has spaces in it'),
      body(code, 'x'.repeat(65)),
      body(code, undefined, { appVersion: undefined }),
      body(code, undefined, { appVersion: 'version one' }),
      body(code, undefined, { deviceName: 42 }),
      'x'.repeat(5000),
    ]) {
      const res = await post(bad)
      expect(res.status, JSON.stringify(bad).slice(0, 60)).toBe(400)
      expect(typeof (await res.json()).message).toBe('string')
    }
    // the code is still unused
    expect(await listOpenCodes()).toHaveLength(1)
  })

  it('trims a long computer name to 80 characters instead of refusing it', async () => {
    const res = await post(body(await newCode(), undefined, { deviceName: `  ${'N'.repeat(200)}  ` }))
    expect(res.status).toBe(200)
    const [row] = await sql()`select device_name from desktop_installs`
    expect(row.device_name).toBe('N'.repeat(80))
  })

  it('allows 20 attempts an hour from one address, then 429', async () => {
    for (let i = 0; i < 20; i++) expect((await post(body(UNKNOWN))).status).toBe(404)
    const res = await post(body(await newCode()))
    expect(res.status).toBe(429)
    expect((await res.json()).message).toMatch(/Too many tries/)
    // another address is counted separately
    expect((await post(body(await newCode()), '203.0.113.99')).status).toBe(200)
  })

  it('counts an IPv6 visitor by its /64 network', async () => {
    for (let i = 1; i <= 20; i++) expect((await post(body('DDP-12'), `2001:db8:1:2::${i.toString(16)}`)).status).toBe(400)
    expect((await post(body(await newCode()), '2001:db8:1:2:ffff::1')).status).toBe(429)
    expect((await post(body(await newCode()), '2001:db8:1:3::1')).status).toBe(200)
  })

  it('stops all activations for the hour after 200 failed ones site-wide', async () => {
    // 10 addresses × 20 bad attempts (bad codes: no database work)
    for (let a = 0; a < 10; a++) {
      for (let i = 0; i < 20; i++) expect((await post(body('DDP-12'), `192.0.2.${a}`)).status).toBe(400)
    }
    const res = await post(body(await newCode()), '192.0.2.200')
    expect(res.status).toBe(429)
    expect((await res.json()).message).toMatch(/on the website right now/)
    // once that hour's failures are forgotten (here: reset), activations work again
    resetActions()
    for (let i = 0; i < 3; i++) expect((await post(body(await newCode(), `computer-${i}`), `192.0.2.${100 + i}`)).status).toBe(200)
  })

  it('answers 503 in production when the code secret is missing', async () => {
    const code = await newCode()
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('DESKTOP_CODE_SECRET', '')
    const res = await post(body(code))
    expect(res.status).toBe(503)
    expect((await res.json()).message).toMatch(/isn’t set up/)
    await expect(createActivationCode('Another', 'owner@example.com')).rejects.toThrow(/DESKTOP_CODE_SECRET/)
  })

  it('makes a code that was made under another secret useless', async () => {
    vi.stubEnv('DESKTOP_CODE_SECRET', 'a'.repeat(64))
    const code = await newCode()
    vi.stubEnv('DESKTOP_CODE_SECRET', 'b'.repeat(64))
    expect((await post(body(code))).status).toBe(404)
  })
})

describe('activating again after a lost reply', () => {
  it('gives the same computer a fresh key within 10 minutes and revokes the first one', async () => {
    const code = await newCode('Venue laptop')
    const first = await (await post(body(code))).json()
    const res = await post(body(code, INSTALL, { appVersion: '0.7.1' }))
    expect(res.status).toBe(200)
    const second = await res.json()
    expect(second).toMatchObject({ label: 'Venue laptop', siteUrl: SITE })
    expect(second.key).not.toBe(first.key)
    expect((await getStatus(bearer(first.key))).status).toBe(401)
    expect((await getStatus(bearer(second.key))).status).toBe(200)

    const rows = await sql()`select id, revoked_at, last_version from desktop_installs where install_id = ${INSTALL} order by id`
    expect(rows.map((r) => [r.revoked_at === null, r.last_version])).toEqual([[false, '0.7.0'], [true, '0.7.1']])
    // the code points at the new row, and keeps the time of its first use
    const [c] = await sql()`select install_row_id, used_at from desktop_activation_codes`
    expect(Number(c.install_row_id)).toBe(Number(rows[1].id))
    expect((await sql()`select action from audit_log order by id`).map((r) => r.action)).toEqual(['desktop_activate', 'desktop_activate_retry'])
  })

  it('still refuses a different computer with 404', async () => {
    const code = await newCode()
    const first = await (await post(body(code))).json()
    expect((await post(body(code, 'a-different-install-id'))).status).toBe(404)
    expect((await getStatus(bearer(first.key))).status).toBe(200) // the real computer is untouched
  })

  it('refuses after 10 minutes, or once that computer was revoked', async () => {
    const code = await newCode()
    await post(body(code))
    await sql()`update desktop_activation_codes set used_at = now() - interval '11 minutes'`
    expect((await post(body(code))).status).toBe(404)

    const other = await newCode()
    await post(body(other, 'second-computer'))
    await revokeInstall(Number((await sql()`select id from desktop_installs where install_id = 'second-computer'`)[0].id))
    expect((await post(body(other, 'second-computer'))).status).toBe(404)
  })

  it('can’t stretch the window by retrying again and again', async () => {
    const code = await newCode()
    await post(body(code))
    await sql()`update desktop_activation_codes set used_at = now() - interval '9 minutes'`
    expect((await post(body(code))).status).toBe(200)
    const [c] = await sql()`select used_at from desktop_activation_codes`
    expect(Date.now() - new Date(c.used_at).getTime()).toBeGreaterThan(8 * 60 * 1000)
  })
})

describe('GET /api/desktop/status/', () => {
  it('activate → status → revoke → 401', async () => {
    const { key } = await activated('Venue laptop')
    const ok = await getStatus(bearer(key, { 'x-app-version': '0.7.0' }))
    expect(ok.status).toBe(200)
    expect(ok.headers.get('cache-control')).toBe('no-store')
    expect(await ok.json()).toEqual({ active: true, label: 'Venue laptop', latestVersion: '0.7.2' })

    expect(await revokeInstall((await firstActive()).id)).toBe('Venue laptop')
    const gone = await getStatus(bearer(key))
    expect(gone.status).toBe(401)
    const out = await gone.json()
    expect(out.active).toBe(false)
    expect(typeof out.message).toBe('string')
  })

  it('401s an unknown or missing key, and says latestVersion null when nothing is published', async () => {
    expect((await getStatus(bearer('x'.repeat(43)))).status).toBe(401)
    expect((await getStatus({})).status).toBe(401)
    const { key } = await activated()
    vi.stubEnv('DOWNLOADS_DIR', '')
    expect(await (await getStatus(bearer(key))).json()).toMatchObject({ active: true, latestVersion: null })
  })

  it('notes last seen and the version, at most once a minute', async () => {
    const { key } = await activated()
    await getStatus(bearer(key, { 'x-app-version': '0.7.1' }))
    let [row] = await sql()`select last_version, last_seen_at from desktop_installs`
    expect(row.last_version).toBe('0.7.0') // activated moments ago: not written again yet

    await sql()`update desktop_installs set last_seen_at = now() - interval '2 minutes'`
    await getStatus(bearer(key, { 'x-app-version': '0.7.1' }))
    ;[row] = await sql()`select last_version, last_seen_at from desktop_installs`
    expect(row.last_version).toBe('0.7.1')
    expect(Date.now() - new Date(row.last_seen_at).getTime()).toBeLessThan(30_000)

    // a version that isn't one is ignored, the visit still counts
    await sql()`update desktop_installs set last_seen_at = now() - interval '2 minutes'`
    await getStatus(bearer(key, { 'x-app-version': '<b>1</b>' }))
    ;[row] = await sql()`select last_version from desktop_installs`
    expect(row.last_version).toBe('0.7.1')
  })

  it('activating the same computer again (new code) revokes its previous row', async () => {
    const id = '7c1d1a5e-0000-4000-8000-000000000001'
    const first = await activated('Laptop A', id)
    const second = await activated('Laptop A again', id)
    expect((await getStatus(bearer(first.key))).status).toBe(401)
    expect((await getStatus(bearer(second.key))).status).toBe(200)
    const rows = await sql()`select label, revoked_at from desktop_installs where install_id = ${id} order by id`
    expect(rows.map((r) => [r.label, r.revoked_at === null])).toEqual([['Laptop A', false], ['Laptop A again', true]])
    // another computer is untouched
    const other = await activated('Laptop B', '7c1d1a5e-0000-4000-8000-000000000002')
    expect((await getStatus(bearer(other.key))).status).toBe(200)
    expect((await getStatus(bearer(second.key))).status).toBe(200)
  })
})

describe('GET /api/desktop/download-check/ (Caddy forward_auth)', () => {
  const FILE = '/downloads/desktop/DeadlyDropsPickleball-Setup-0.7.2.exe'

  it('lets an activated computer through with its key, never a revoked one or the old shared key', async () => {
    const { key } = await activated()
    const ok = await check(FILE, bearer(key))
    expect(ok.status).toBe(204)
    expect(ok.headers.get('cache-control')).toBe('no-store')
    expect(ok.headers.get('location')).toBeNull()
    expect((await check('/downloads/desktop/latest.yml?noCache=abc', bearer(key))).status).toBe(204)

    const legacy = await rotateAppKey()
    expect((await check(FILE, bearer(legacy))).status).toBe(401)
    await revokeInstall((await firstActive()).id)
    expect((await check(FILE, bearer(key))).status).toBe(401)
  })

  it('lets a signed-in staff manager through, not other staff and not strangers', async () => {
    expect((await check(FILE)).status).toBe(401)
    await staffCookie({ staff: 'view', tournaments: 'edit' })
    expect((await check(FILE)).status).toBe(401)
    await staffCookie({ staff: 'edit' })
    expect((await check(FILE)).status).toBe(204)
    jar.set('dd_admin', 'not-a-real-session')
    expect((await check(FILE)).status).toBe(401)
  })

  it('refuses any other path with 403, even with a good key', async () => {
    const { key } = await activated()
    for (const uri of [null, '/downloads/other/x.exe', '/admin/', '/downloads/desktop/../../admin/', '/downloads/desktop/%2e%2e/x', '/downloads/desktop/a%5Cb']) {
      const res = await check(uri, bearer(key))
      expect(res.status, String(uri)).toBe(403)
      expect(res.headers.get('location')).toBeNull()
    }
  })
})

describe('the tournament downloads (/api/tournaments/)', () => {
  const list = (headers: Record<string, string>) => listTournaments(new Request(`${SITE}/api/tournaments/`, { headers }))
  const one = (id: string, headers: Record<string, string>) =>
    oneTournament(new Request(`${SITE}/api/tournaments/${id}/`, { headers }), { params: Promise.resolve({ id }) })

  it('accept an activated computer’s key and note that it was seen', async () => {
    const { key } = await activated()
    await sql()`update desktop_installs set last_seen_at = now() - interval '2 minutes'`
    const res = await list(bearer(key, { 'x-app-version': '0.7.1' }))
    expect(res.status).toBe(200)
    expect(Array.isArray((await res.json()).tournaments)).toBe(true)
    expect((await one('999', bearer(key))).status).toBe(404) // past the key check
    const [row] = await sql()`select last_version, last_seen_at from desktop_installs`
    expect(row.last_version).toBe('0.7.1')
    expect(Date.now() - new Date(row.last_seen_at).getTime()).toBeLessThan(30_000)
  })

  it('still accept the older shared key, and refuse a revoked computer or no key', async () => {
    const legacy = await rotateAppKey()
    expect((await list(bearer(legacy))).status).toBe(200)
    const { key } = await activated()
    await revokeInstall((await firstActive()).id)
    expect((await list(bearer(key))).status).toBe(401)
    expect((await one('1', bearer(key))).status).toBe(401)
    expect((await list({})).status).toBe(401)
  })
})

describe('codes and computers in the database', () => {
  it(`hold the ${MAX_OPEN_CODES}-code cap when many are made at once`, async () => {
    const results = await Promise.allSettled(Array.from({ length: MAX_OPEN_CODES + 5 }, (_, i) => newCode(`Laptop ${i}`)))
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(MAX_OPEN_CODES)
    expect(results.filter((r) => r.status === 'rejected' && r.reason instanceof TooManyCodesError)).toHaveLength(5)
    expect(await listOpenCodes()).toHaveLength(MAX_OPEN_CODES)
  })

  it('tidy away long-expired unused codes and codes used long ago, keeping recent ones', async () => {
    const s = sql()
    const add = (hash: string, created: string, expires: string, used: string | null) =>
      s.unsafe(
        `insert into desktop_activation_codes (code_hash, label, created_by, created_at, expires_at, used_at)
         values ($1, 'old', 'owner@example.com', now() - $2::interval, now() - $3::interval, ${used ? 'now() - $4::interval' : 'null'})`,
        used ? [hash, created, expires, used] : [hash, created, expires],
      )
    await add('a'.repeat(64), '40 days', '33 days', null) // ran out a month ago, never used: goes
    await add('b'.repeat(64), '10 days', '3 days', null) // ran out recently: kept a while
    await add('c'.repeat(64), '100 days', '93 days', '95 days') // used long ago: goes
    await add('d'.repeat(64), '20 days', '13 days', '19 days') // used recently: kept
    await newCode('New')
    const left = await s`select code_hash from desktop_activation_codes where label = 'old' order by code_hash`
    expect(left.map((r) => r.code_hash[0])).toEqual(['b', 'd'])
  })

  it(`list active computers and the newest ${REVOKED_SHOWN} revoked ones, with the true revoked count`, async () => {
    await sql().unsafe(`
      insert into desktop_installs (label, install_id, key_hash, created_by, activated_at, revoked_at)
      select 'Old ' || n, 'old-' || n, lpad(to_hex(n), 64, '0'), 'owner@example.com', now() - interval '30 days', now() - (n || ' minutes')::interval
      from generate_series(1, 52) as n`)
    await activated('Current')
    const { active, revoked, revokedTotal } = await listInstalls()
    expect(active.map((i) => i.label)).toEqual(['Current'])
    expect(revokedTotal).toBe(52)
    expect(revoked).toHaveLength(REVOKED_SHOWN)
    expect(revoked[0].label).toBe('Old 1') // revoked most recently first
    expect(revoked.at(-1)!.label).toBe(`Old ${REVOKED_SHOWN}`)
  })
})

describe('Admin → Desktop app actions', () => {
  it('refuse anyone who isn’t signed in or can’t manage staff', async () => {
    expect((await actions.createActivationCodeAction('Laptop')).ok).toBe(false)
    await staffCookie({ staff: 'view', tournaments: 'edit' })
    const r = await actions.createActivationCodeAction('Laptop')
    expect(r).toMatchObject({ ok: false })
    expect(r.code).toBeUndefined()
    expect(await listOpenCodes()).toHaveLength(0)
  })

  it('make a code shown once, list it, cancel it, and revoke a computer, each in the audit log', async () => {
    const me = await staffCookie({ staff: 'edit' })
    expect((await actions.createActivationCodeAction('   ')).ok).toBe(false)
    expect((await actions.createActivationCodeAction('x'.repeat(61))).ok).toBe(false)
    expect((await actions.createActivationCodeAction(42)).ok).toBe(false)

    const made = await actions.createActivationCodeAction('  Venue   laptop ')
    expect(made).toMatchObject({ ok: true, label: 'Venue laptop' })
    expect(made.code).toMatch(/^DDP(-[0-9A-HJKMNP-TV-Z]{4}){3}$/)
    const open = await listOpenCodes()
    expect(open).toMatchObject([{ id: made.id, label: 'Venue laptop', createdBy: me.email }])
    expect(new Date(open[0].expiresAt).getTime() - Date.now()).toBeGreaterThan(6.9 * 24 * 3600 * 1000)

    expect((await actions.cancelActivationCodeAction('1')).ok).toBe(false)
    expect((await actions.cancelActivationCodeAction(made.id)).ok).toBe(true)
    expect((await actions.cancelActivationCodeAction(made.id)).ok).toBe(false)
    expect((await post(body(made.code!))).status).toBe(404)

    const { key } = await activated()
    const install = await firstActive()
    expect((await actions.revokeInstallAction(install.id)).ok).toBe(true)
    expect((await actions.revokeInstallAction(install.id)).ok).toBe(false)
    expect((await getStatus(bearer(key))).status).toBe(401)

    const log = await sql()`select action, detail, who from audit_log order by id`
    expect(log.map((r) => r.action)).toEqual(expect.arrayContaining(['desktop_code_create', 'desktop_code_cancel', 'desktop_install_revoke']))
    for (const r of log) expect(r.detail).not.toContain(made.code)
  })

  it('report a committed change as done even when the audit log can’t be written', async () => {
    await staffCookie({ staff: 'edit' })
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    await sql()`alter table audit_log rename to audit_log_away`
    try {
      const made = await actions.createActivationCodeAction('Laptop')
      expect(made.ok).toBe(true)
      expect((await actions.cancelActivationCodeAction(made.id)).ok).toBe(true)
    } finally {
      await sql()`alter table audit_log_away rename to audit_log`
      err.mockRestore()
    }
  })
})
