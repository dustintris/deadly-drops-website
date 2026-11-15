import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

/**
 * Signed admin session cookie: base64url(JSON payload).HMAC-SHA256.
 * httpOnly, SameSite=Strict, Secure in production, 8 hours.
 * Single owner account from env (ADMIN_EMAIL / ADMIN_PASSWORD_HASH); raise
 * ADMIN_SESSION_VERSION to sign every session out.
 */
export const COOKIE = 'dd_admin'
const MAX_AGE = 8 * 60 * 60

type Session = { email: string; exp: number; v: string }

function secret(): Buffer {
  const s = process.env.SESSION_SECRET || ''
  if (Buffer.byteLength(s) < 32) throw new Error('SESSION_SECRET must be at least 32 characters (run npm run admin:setup).')
  return Buffer.from(s)
}
const sign = (data: string) => createHmac('sha256', secret()).update(data).digest('base64url')
const version = () => process.env.ADMIN_SESSION_VERSION || '1'

export function adminConfigured(): boolean {
  return !!process.env.ADMIN_EMAIL && !!process.env.ADMIN_PASSWORD_HASH && Buffer.byteLength(process.env.SESSION_SECRET || '') >= 32
}

export async function createSession(email: string) {
  const payload: Session = { email, exp: Math.floor(Date.now() / 1000) + MAX_AGE, v: version() }
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url')
  ;(await cookies()).set(COOKIE, `${data}.${sign(data)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: MAX_AGE,
  })
}

export async function destroySession() {
  ;(await cookies()).delete(COOKIE)
}

export async function getSession(): Promise<Session | null> {
  if (!adminConfigured()) return null
  const raw = (await cookies()).get(COOKIE)?.value
  if (!raw) return null
  const [data, mac] = raw.split('.')
  if (!data || !mac) return null
  const expected = Buffer.from(sign(data))
  const given = Buffer.from(mac)
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null
  try {
    const s = JSON.parse(Buffer.from(data, 'base64url').toString()) as Session
    if (s.exp < Date.now() / 1000 || s.v !== version() || s.email !== process.env.ADMIN_EMAIL) return null
    return s
  } catch {
    return null
  }
}

/** Call at the top of every admin page and Server Action. Route Handlers use getSession() and return 401. */
export async function requireAdmin(): Promise<Session> {
  const s = await getSession()
  if (!s) redirect('/admin/login/')
  return s
}
