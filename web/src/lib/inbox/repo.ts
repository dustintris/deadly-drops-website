import 'server-only'
import { count, desc, eq, isNotNull, isNull, sql } from 'drizzle-orm'
import { getDb } from '@/db/client'
import { contactMessages, emailSignups } from '@/db/schema'
import type { ContactInputT } from './input'

/** Contact-form messages and the mailing list, as Admin → Inbox shows them. */

export type InboxMessage = {
  id: number
  name: string
  email: string
  topic: string
  message: string
  createdAt: string
  handledAt: string | null
  handledBy: string | null
}
export type Signup = { id: number; email: string; createdAt: string }

const iso = (d: Date | null) => (d ? d.toISOString() : null)

export async function addMessage(m: Omit<ContactInputT, 'website'>): Promise<void> {
  await getDb().insert(contactMessages).values({ name: m.name, email: m.email, topic: m.topic, message: m.message })
}

/** Adds an address once; true when it is new. A repeat sign-up changes nothing. */
export async function addSignup(email: string): Promise<boolean> {
  const rows = await getDb().insert(emailSignups).values({ email: email.trim().toLowerCase() }).onConflictDoNothing().returning({ id: emailSignups.id })
  return rows.length > 0
}

/** Every open message, plus the newest `handledLimit` dealt-with ones; newest first. An open one never drops off. */
export async function listMessages(handledLimit = 200): Promise<InboxMessage[]> {
  const db = getDb()
  const [open, handled] = await Promise.all([
    db.select().from(contactMessages).where(isNull(contactMessages.handledAt)).orderBy(desc(contactMessages.id)),
    db.select().from(contactMessages).where(isNotNull(contactMessages.handledAt)).orderBy(desc(contactMessages.id)).limit(handledLimit),
  ])
  return [...open, ...handled]
    .sort((a, b) => b.id - a.id)
    .map((r) => ({ ...r, createdAt: r.createdAt.toISOString(), handledAt: iso(r.handledAt) }))
}

export async function countOpenMessages(): Promise<number> {
  const [r] = await getDb().select({ n: count() }).from(contactMessages).where(isNull(contactMessages.handledAt))
  return r?.n ?? 0
}

/** Marks a message dealt with (by `who`), or open again with null. False when it no longer exists. */
export async function setHandled(id: number, who: string | null): Promise<boolean> {
  const rows = await getDb()
    .update(contactMessages)
    // the database's clock, like created_at, so "dealt with" can never come out before "sent"
    .set(who ? { handledAt: sql`now()`, handledBy: who } : { handledAt: null, handledBy: null })
    .where(eq(contactMessages.id, id))
    .returning({ id: contactMessages.id })
  return rows.length > 0
}

export async function deleteMessage(id: number): Promise<boolean> {
  return (await getDb().delete(contactMessages).where(eq(contactMessages.id, id)).returning({ id: contactMessages.id })).length > 0
}

/** Newest first; the newest `limit` for the admin page, all of them (no limit) for the download. */
export async function listSignups(limit?: number): Promise<Signup[]> {
  const q = getDb().select().from(emailSignups).orderBy(desc(emailSignups.id))
  const rows = await (limit ? q.limit(limit) : q)
  return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }))
}

export async function countSignups(): Promise<number> {
  const [r] = await getDb().select({ n: count() }).from(emailSignups)
  return r?.n ?? 0
}

export async function deleteSignup(id: number): Promise<boolean> {
  return (await getDb().delete(emailSignups).where(eq(emailSignups.id, id)).returning({ id: emailSignups.id })).length > 0
}

/**
 * The mailing list as CSV for a mail tool or a spreadsheet. A cell starting with = + - @ (or a tab/return) is
 * prefixed with ' so a spreadsheet shows it as text instead of running it as a formula.
 */
export function signupsCsv(rows: Signup[]): string {
  const cell = (v: string) => {
    const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v
    return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
  }
  return ['email,signed_up', ...rows.map((r) => `${cell(r.email)},${cell(r.createdAt.slice(0, 10))}`)].join('\r\n') + '\r\n'
}
