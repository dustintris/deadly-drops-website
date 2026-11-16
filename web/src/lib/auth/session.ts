import 'server-only'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { cache } from 'react'
import { can, type Area, type Level } from './permissions'
import { createSessionRow, deleteSessionByToken, findSessionUser, type StaffUser } from './sessions'
import { countUsers, syncEnvOwner } from './users'

/**
 * Admin sign-in: an HttpOnly, SameSite=Strict cookie (Secure in production, 8 hours) holding a
 * random token that matches a row in `sessions`. Signing out deletes that row; disabling a person
 * deletes all of theirs. Permissions are read from the database on every request, so a change to
 * someone's access applies at once.
 */
// __Host- prefix (production): Secure, Path=/, no Domain, so no subdomain can set or overwrite it
export const COOKIE = process.env.NODE_ENV === 'production' ? '__Host-dd_admin' : 'dd_admin'
const MAX_AGE = 8 * 60 * 60

export type Session = StaffUser & { tokenHash: string }

let ownerSync: Promise<void> | null = null
/**
 * Bring the server's owner (ADMIN_EMAIL / ADMIN_PASSWORD_HASH) into the staff table, once per
 * server process (the environment only changes with a restart). A failure is retried next time.
 */
export function ensureEnvOwner(): Promise<void> {
  const email = process.env.ADMIN_EMAIL
  const passwordHash = process.env.ADMIN_PASSWORD_HASH
  if (!email || !passwordHash) return Promise.resolve()
  ownerSync ??= syncEnvOwner({ email, passwordHash }).catch((e) => {
    ownerSync = null
    throw e
  })
  return ownerSync
}

/** Whether anyone can sign in at all (an owner on the server, or staff logins). */
export async function loginAvailable(): Promise<boolean> {
  await ensureEnvOwner()
  return (await countUsers()) > 0
}

export async function createSession(userId: number): Promise<void> {
  const jar = await cookies()
  // a fresh token on every sign-in; an older session this browser still held is ended, not left behind
  const previous = jar.get(COOKIE)?.value
  if (previous) await deleteSessionByToken(previous)
  const userAgent = (await headers()).get('user-agent') ?? ''
  const token = await createSessionRow(userId, userAgent, MAX_AGE * 1000)
  jar.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: MAX_AGE,
  })
}

/** Sign this device out. */
export async function destroySession(): Promise<void> {
  const jar = await cookies()
  const token = jar.get(COOKIE)?.value
  if (token) await deleteSessionByToken(token)
  jar.delete(COOKIE)
}

/** This device's session token (to keep it signed in after a password change). */
export async function currentSessionToken(): Promise<string | undefined> {
  return (await cookies()).get(COOKIE)?.value
}

/** The signed-in staff member for this request, or null. Looked up once per request. */
export const getSession = cache(async (): Promise<Session | null> => {
  const token = (await cookies()).get(COOKIE)?.value
  if (!token) return null
  const found = await findSessionUser(token)
  return found ? { ...found.user, tokenHash: found.tokenHash } : null
})

/** Call at the top of every admin page and Server Action. Route Handlers use getSession() and return 401. */
export async function requireAdmin(): Promise<Session> {
  const s = await getSession()
  if (!s) redirect('/admin/login/')
  return s
}

/** Pages: signed in AND allowed; otherwise back to the dashboard, which explains. */
export async function requirePermission(area: Area, level: Exclude<Level, 'none'> = 'view'): Promise<Session> {
  const s = await requireAdmin()
  if (!can(s, area, level)) redirect(`/admin/?denied=${area}`)
  return s
}
