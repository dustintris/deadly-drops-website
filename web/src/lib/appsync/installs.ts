import 'server-only'
import { and, asc, count, desc, eq, gt, isNotNull, isNull, lt, or, sql } from 'drizzle-orm'
import { getDb } from '@/db/client'
import { desktopActivationCodes, desktopInstalls } from '@/db/schema'
import { hashActivationCode, newActivationCode, newInstallKey, sameHex, sha256Hex } from './codes'

/**
 * Computers that may use the desktop app. Staff make a one-time code in Admin → Desktop app; the app trades it for
 * its own key (POST /api/desktop/activate/). The key opens the tournament downloads, the status check and the
 * installer and updates; revoking the computer stops all of them.
 */

export const CODE_TTL_MS = 7 * 24 * 60 * 60 * 1000
/** Unused codes allowed at once: each one is a door that's open for a week. */
export const MAX_OPEN_CODES = 20
/** A code used this recently may be used again by the same computer, when the app never got the reply. */
export const RETRY_MS = 10 * 60 * 1000
/** Revoked computers listed in the admin (the newest; the count is of all of them). */
export const REVOKED_SHOWN = 50
/** Advisory lock taken while making a code, so the cap holds when two are made at once. */
const CODES_LOCK = 0x0dd9_dc0d
const LAST_SEEN_EVERY = sql`interval '1 minute'`

export class TooManyCodesError extends Error {
  constructor() {
    super(`There are already ${MAX_OPEN_CODES} unused codes. Cancel the ones you don’t need, then make a new one.`)
  }
}

export type OpenCode = { id: number; label: string; createdBy: string; createdAt: string; expiresAt: string }

export type DesktopInstall = {
  id: number
  label: string
  deviceName: string
  lastVersion: string | null
  createdBy: string
  activatedAt: string
  lastSeenAt: string | null
  revokedAt: string | null
}

const iso = (d: Date | null) => d?.toISOString() ?? null
const openCode = and(isNull(desktopActivationCodes.usedAt), gt(desktopActivationCodes.expiresAt, sql`now()`))

/* ---------- codes ---------- */

/** A new code for a computer called `label`. The code is returned once; only its HMAC is kept. */
export async function createActivationCode(label: string, createdBy: string): Promise<{ id: number; code: string; label: string; expiresAt: string }> {
  hashActivationCode('') // refuse before writing anything when the server has no secret
  const expiresAt = new Date(Date.now() + CODE_TTL_MS)
  return getDb().transaction(async (tx) => {
    // tidy, count and insert as one step: two codes made at once can't both slip under the cap
    await tx.execute(sql`select pg_advisory_xact_lock(${CODES_LOCK})`)
    await tx
      .delete(desktopActivationCodes)
      .where(
        or(
          // nobody used it, and it ran out a month ago
          and(isNull(desktopActivationCodes.usedAt), lt(desktopActivationCodes.expiresAt, sql`now() - interval '30 days'`)),
          // used long ago (the audit log keeps the history)
          lt(desktopActivationCodes.usedAt, sql`now() - interval '90 days'`),
        ),
      )
    const [{ open }] = await tx.select({ open: count() }).from(desktopActivationCodes).where(openCode)
    if (open >= MAX_OPEN_CODES) throw new TooManyCodesError()

    // two codes alike is a 1 in 10^18 chance: draw again (a conflict that aborted the transaction can't be retried)
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = newActivationCode()
      const [row] = await tx
        .insert(desktopActivationCodes)
        .values({ codeHash: hashActivationCode(code), label, createdBy: createdBy.slice(0, 254), expiresAt })
        .onConflictDoNothing({ target: desktopActivationCodes.codeHash })
        .returning({ id: desktopActivationCodes.id })
      if (row) return { id: row.id, code, label, expiresAt: expiresAt.toISOString() }
    }
    throw new Error('Could not draw an unused activation code')
  })
}

/** Codes not used yet and still valid, soonest to expire first. */
export async function listOpenCodes(): Promise<OpenCode[]> {
  const rows = await getDb().select().from(desktopActivationCodes).where(openCode).orderBy(asc(desktopActivationCodes.expiresAt))
  return rows.map((r) => ({ id: r.id, label: r.label, createdBy: r.createdBy, createdAt: r.createdAt.toISOString(), expiresAt: r.expiresAt.toISOString() }))
}

/** Cancel an unused code. Returns its label, or null when it was already used or gone. */
export async function cancelActivationCode(id: number): Promise<string | null> {
  const [row] = await getDb()
    .delete(desktopActivationCodes)
    .where(and(eq(desktopActivationCodes.id, id), isNull(desktopActivationCodes.usedAt)))
    .returning({ label: desktopActivationCodes.label })
  return row?.label ?? null
}

/* ---------- activation ---------- */

export type ActivateOutcome =
  | { ok: true; key: string; label: string; installRowId: number; revokedRowIds: number[]; retried: boolean }
  | { ok: false; reason: 'unknown' | 'expired' }

/**
 * Trade a code (normalised: DDP-XXXX-XXXX-XXXX) for a new install key, in one transaction: the code is marked used,
 * the install row is made, and any active row this computer (installId) already had is revoked. Two activations of
 * the same computer at once take turns, so it never ends up with two active rows.
 *
 * A lost reply: when the code was used less than RETRY_MS ago by this same computer (installId), and that install is
 * still active, the computer gets a fresh key and that row is revoked. Any other reuse of a used code is "unknown".
 */
export async function activateInstall(input: { code: string; installId: string; deviceName: string; appVersion: string | null }): Promise<ActivateOutcome> {
  const codeHash = hashActivationCode(input.code)
  const key = newInstallKey()
  return getDb().transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`ddp-desktop-install:${input.installId}`}, 0))`)
    const [code] = await tx
      .select()
      .from(desktopActivationCodes)
      .where(eq(desktopActivationCodes.codeHash, codeHash))
      .limit(1)
      .for('update')
    if (!code || !sameHex(code.codeHash, codeHash)) return { ok: false, reason: 'unknown' } as const

    let retried = false
    if (code.usedAt) {
      if (code.installRowId === null || Date.now() - code.usedAt.getTime() >= RETRY_MS) return { ok: false, reason: 'unknown' } as const
      const [previous] = await tx
        .select({ installId: desktopInstalls.installId, revokedAt: desktopInstalls.revokedAt })
        .from(desktopInstalls)
        .where(eq(desktopInstalls.id, code.installRowId))
        .limit(1)
        .for('update')
      if (!previous || previous.revokedAt || previous.installId !== input.installId) return { ok: false, reason: 'unknown' } as const
      retried = true
    } else if (code.expiresAt.getTime() <= Date.now()) {
      return { ok: false, reason: 'expired' } as const
    }

    const now = new Date()
    const revoked = await tx
      .update(desktopInstalls)
      .set({ revokedAt: now })
      .where(and(eq(desktopInstalls.installId, input.installId), isNull(desktopInstalls.revokedAt)))
      .returning({ id: desktopInstalls.id })
    const [row] = await tx
      .insert(desktopInstalls)
      .values({
        label: code.label,
        installId: input.installId,
        deviceName: input.deviceName,
        keyHash: sha256Hex(key),
        createdBy: code.createdBy,
        activatedAt: now,
        lastSeenAt: now,
        lastVersion: input.appVersion,
      })
      .returning({ id: desktopInstalls.id })
    // a retry keeps the first use's time, so the window can't be stretched by asking again and again
    await tx
      .update(desktopActivationCodes)
      .set({ usedAt: code.usedAt ?? now, installRowId: row.id })
      .where(eq(desktopActivationCodes.id, code.id))
    return { ok: true, key, label: code.label, installRowId: row.id, revokedRowIds: revoked.map((r) => r.id), retried } as const
  })
}

/* ---------- installs ---------- */

/** The active (not revoked) install holding this key, or null. */
export async function findActiveInstall(key: string | null): Promise<{ id: number; label: string } | null> {
  if (!key || key.length > 200) return null
  const hash = sha256Hex(key)
  const [row] = await getDb()
    .select({ id: desktopInstalls.id, label: desktopInstalls.label, keyHash: desktopInstalls.keyHash })
    .from(desktopInstalls)
    .where(and(eq(desktopInstalls.keyHash, hash), isNull(desktopInstalls.revokedAt)))
    .limit(1)
  return row && sameHex(row.keyHash, hash) ? { id: row.id, label: row.label } : null
}

/** Note that an install was in touch (and its version, when it said), at most once a minute. */
export async function touchInstall(id: number, appVersion: string | null): Promise<void> {
  await getDb()
    .update(desktopInstalls)
    .set(appVersion ? { lastSeenAt: sql`now()`, lastVersion: appVersion } : { lastSeenAt: sql`now()` })
    .where(
      and(
        eq(desktopInstalls.id, id),
        isNull(desktopInstalls.revokedAt),
        or(isNull(desktopInstalls.lastSeenAt), lt(desktopInstalls.lastSeenAt, sql`now() - ${LAST_SEEN_EVERY}`)),
      ),
    )
}

const toInstall = (r: typeof desktopInstalls.$inferSelect): DesktopInstall => ({
  id: r.id,
  label: r.label,
  deviceName: r.deviceName,
  lastVersion: r.lastVersion,
  createdBy: r.createdBy,
  activatedAt: r.activatedAt.toISOString(),
  lastSeenAt: iso(r.lastSeenAt),
  revokedAt: iso(r.revokedAt),
})

/** Active computers (newest first), the newest REVOKED_SHOWN revoked ones, and how many were revoked in all. */
export async function listInstalls(): Promise<{ active: DesktopInstall[]; revoked: DesktopInstall[]; revokedTotal: number }> {
  const db = getDb()
  const [active, revoked, [{ total }]] = await Promise.all([
    db.select().from(desktopInstalls).where(isNull(desktopInstalls.revokedAt)).orderBy(desc(desktopInstalls.activatedAt)),
    // "desc nulls last" matches desktop_installs_revoked_idx exactly
    db
      .select()
      .from(desktopInstalls)
      .where(isNotNull(desktopInstalls.revokedAt))
      .orderBy(sql`${desktopInstalls.revokedAt} desc nulls last`)
      .limit(REVOKED_SHOWN),
    db.select({ total: count() }).from(desktopInstalls).where(isNotNull(desktopInstalls.revokedAt)),
  ])
  return { active: active.map(toInstall), revoked: revoked.map(toInstall), revokedTotal: total }
}

/** Revoke an install: its key stops working at once. Returns its label, or null when it was already revoked or gone. */
export async function revokeInstall(id: number): Promise<string | null> {
  const [row] = await getDb()
    .update(desktopInstalls)
    .set({ revokedAt: new Date() })
    .where(and(eq(desktopInstalls.id, id), isNull(desktopInstalls.revokedAt)))
    .returning({ label: desktopInstalls.label })
  return row?.label ?? null
}
