'use server'

import { revalidatePath } from 'next/cache'
import { audit } from '@/lib/audit'
import { can } from '@/lib/auth/permissions'
import { requireAdmin } from '@/lib/auth/session'
import { deleteMessage, deleteSignup, setHandled } from '@/lib/inbox/repo'

/** Admin → Inbox. Reading needs "Website content: view"; these changes need "Website content: edit". */

export type InboxResult = { ok: boolean; message: string }

const NO_EDIT: InboxResult = { ok: false, message: 'You can read the inbox, but your login can’t change it. Ask the owner if you need access.' }
const GONE: InboxResult = { ok: false, message: 'That was already removed. The list is up to date now.' }
const validId = (id: unknown): id is number => typeof id === 'number' && Number.isSafeInteger(id) && id > 0

async function editor() {
  const s = await requireAdmin()
  return can(s, 'content', 'edit') ? s : null
}

export async function setMessageHandledAction(id: number, handled: boolean): Promise<InboxResult> {
  const s = await editor()
  if (!s) return NO_EDIT
  if (!validId(id) || typeof handled !== 'boolean') return { ok: false, message: 'Something went wrong. Reload the page.' }
  const done = await setHandled(id, handled ? (s.name || s.email) : null)
  revalidatePath('/admin/inbox/')
  revalidatePath('/admin/')
  if (!done) return GONE
  await audit(s.email, handled ? 'inbox_handled' : 'inbox_reopened', String(id))
  return { ok: true, message: handled ? 'Marked as dealt with.' : 'Moved back to open.' }
}

export async function deleteMessageAction(id: number): Promise<InboxResult> {
  const s = await editor()
  if (!s) return NO_EDIT
  if (!validId(id)) return { ok: false, message: 'Something went wrong. Reload the page.' }
  const done = await deleteMessage(id)
  revalidatePath('/admin/inbox/')
  revalidatePath('/admin/')
  if (!done) return GONE
  await audit(s.email, 'inbox_message_deleted', String(id))
  return { ok: true, message: 'Message deleted.' }
}

export async function deleteSignupAction(id: number): Promise<InboxResult> {
  const s = await editor()
  if (!s) return NO_EDIT
  if (!validId(id)) return { ok: false, message: 'Something went wrong. Reload the page.' }
  const done = await deleteSignup(id)
  revalidatePath('/admin/inbox/')
  if (!done) return GONE
  await audit(s.email, 'inbox_signup_deleted', String(id))
  return { ok: true, message: 'Removed from the mailing list.' }
}
