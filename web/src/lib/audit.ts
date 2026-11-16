import 'server-only'
import { desc } from 'drizzle-orm'
import { getDb } from '@/db/client'
import { auditLog } from '@/db/schema'

export type AuditEntry = { at: string; who: string; action: string; detail: string }

/**
 * Append-only record of every admin action. Field lengths are capped so one entry can't bloat the log.
 * Best-effort: it runs after the action has already happened (a save is committed, a login has failed),
 * so a logging failure is reported to the server log instead of turning a done action into an error.
 */
export async function audit(who: string, action: string, detail = ''): Promise<void> {
  try {
    await getDb()
      .insert(auditLog)
      .values({ who: who.slice(0, 254), action: action.slice(0, 40), detail: detail.slice(0, 300) })
  } catch (e) {
    console.error('[audit] could not record', action, e)
  }
}

/** The newest n entries, newest first. */
export async function recentAudit(n = 10): Promise<AuditEntry[]> {
  const rows = await getDb().select().from(auditLog).orderBy(desc(auditLog.id)).limit(n)
  return rows.map((r) => ({ at: r.at.toISOString(), who: r.who, action: r.action, detail: r.detail }))
}
