'use server'

import { headers } from 'next/headers'
import { clientIp } from '@/lib/auth/rate-limit'
import { ContactInput, fieldErrors, SignupInput } from '@/lib/inbox/input'
import { allowSubmission } from '@/lib/inbox/limit'
import { addMessage, addSignup } from '@/lib/inbox/repo'

/**
 * The public site's two forms. Anyone can call these, so each address is throttled before anything else runs
 * (bad and oversized posts count too), every input is checked again here (the browser's check is only for
 * comfort), and a hidden trap field catches simple bots.
 */

export type FormResult = { ok: boolean; message?: string; errors?: Record<string, string> }

const BUSY = 'Too many tries from this connection. Try again in an hour, or email us directly.'
const FAILED = 'That didn’t go through just now. Try again in a moment, or email us directly.'

let warnedNoProxy = false
async function caller(): Promise<string> {
  const ip = clientIp(await headers())
  if (!warnedNoProxy && (ip === 'direct' || ip === 'unknown')) {
    warnedNoProxy = true
    console.warn('[inbox] no visitor address from the proxy (X-Forwarded-For): every visitor shares one form limit')
  }
  return ip
}

/** What went wrong, without the query's values: a failed insert's error carries the visitor's name and message. */
function reason(e: unknown): string {
  const cause = (e as { cause?: { code?: string; message?: string } })?.cause
  return [cause?.code, cause?.message ?? (e instanceof Error ? e.name : 'unknown error')].filter(Boolean).join(' ')
}

export async function sendContactMessage(input: unknown): Promise<FormResult> {
  if (!allowSubmission('contact', await caller())) return { ok: false, message: BUSY }
  const r = ContactInput.safeParse(input)
  if (!r.success) return { ok: false, errors: fieldErrors(r.error) }
  // a bot filled the hidden field: say thanks, keep nothing (counted, so a real person caught by it shows up in the log)
  if (r.data.website) {
    console.warn('[inbox] contact form trap field filled: not stored')
    return { ok: true }
  }
  try {
    await addMessage(r.data)
  } catch (e) {
    console.error('[inbox] contact message not saved:', reason(e))
    return { ok: false, message: FAILED }
  }
  return { ok: true }
}

export async function joinMailingList(input: unknown): Promise<FormResult> {
  if (!allowSubmission('signup', await caller())) return { ok: false, message: BUSY }
  const r = SignupInput.safeParse(input)
  if (!r.success) return { ok: false, errors: fieldErrors(r.error) }
  if (r.data.website) {
    console.warn('[inbox] email list trap field filled: not stored')
    return { ok: true }
  }
  try {
    // the same answer whether the address is new or already on the list: nobody can check who subscribed
    await addSignup(r.data.email)
  } catch (e) {
    console.error('[inbox] sign-up not saved:', reason(e))
    return { ok: false, message: FAILED }
  }
  return { ok: true }
}
