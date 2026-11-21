import { z } from 'zod'
import { audit } from '@/lib/audit'
import { addressKey, allowAction, clientIp, countActions, recordAction } from '@/lib/auth/rate-limit'
import { cleanAppVersion, cleanText, DesktopSetupError, normalizeActivationCode } from '@/lib/appsync/codes'
import { json } from '@/lib/appsync/http'
import { activateInstall } from '@/lib/appsync/installs'
import { siteAddress } from '@/lib/appsync/site'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/desktop/activate/ — the desktop app trades a one-time code from Admin → Desktop app for its own key.
 * Body { code, installId, deviceName, appVersion } → 200 { key, label, siteUrl }; 400 · 404 · 410 · 429 · 503
 * with { message } written for whoever is at the computer. The key is in the reply once and never logged; codes are
 * never logged either.
 *
 * Throttled per address (IPv6 by its /64): 20 attempts an hour. Site-wide, 200 failed activations an hour stop all
 * activations for the rest of that hour, so codes can't be guessed from many addresses at once.
 */

const HOUR = 60 * 60 * 1000
const PER_ADDRESS_PER_HOUR = 20
const FAILED_PER_HOUR = 200
const FAILED_KEY = 'desktop-activate-failures'
const MAX_BODY = 4096

const MSG = {
  tooMany: 'Too many tries from this network. Wait an hour, then try again.',
  busy: 'Too many tries on the website right now. Wait an hour, then try again.',
  badApp: 'This copy of the app sent something the website didn’t understand. Download the app again from the website, then try again.',
  badCode: 'That doesn’t look like an activation code. Codes look like DDP-7K3M-Q9TX-4WZ8: check it and try again.',
  unknown: 'That code isn’t right, or it has already been used. Check it, or ask for a new code from Admin → Desktop app on the website.',
  expired: 'That code has expired. Ask for a new one from Admin → Desktop app on the website.',
  notSetUp: 'Activation isn’t set up on the website yet. Ask the website’s owner to finish setting it up, then try again.',
  failed: 'Something went wrong on the website. Try again in a few minutes.',
}

const Body = z.object({
  code: z.string().max(64),
  installId: z.string().regex(/^[A-Za-z0-9-]{1,64}$/),
  deviceName: z.string().max(1000).optional().default(''),
  appVersion: z.string().max(32).refine((v) => cleanAppVersion(v) !== null),
})

async function readBody(req: Request): Promise<unknown> {
  if (Number(req.headers.get('content-length') ?? 0) > MAX_BODY) return null
  try {
    const text = await req.text()
    return text.length > MAX_BODY ? null : JSON.parse(text)
  } catch {
    return null
  }
}

/** A failed activation: counted site-wide and logged with the address and why (never the code). */
function refuse(address: string, reason: string, status: 400 | 404 | 410, message: string) {
  recordAction(FAILED_KEY, HOUR)
  console.warn(`[desktop] activation refused: ${reason} (from ${address})`)
  return json({ message }, status)
}

export async function POST(req: Request) {
  const address = addressKey(clientIp(req.headers))
  if (countActions(FAILED_KEY, HOUR) >= FAILED_PER_HOUR) return json({ message: MSG.busy }, 429)
  // every attempt counts, good or bad
  if (!allowAction(`desktop-activate:${address}`, PER_ADDRESS_PER_HOUR, HOUR)) return json({ message: MSG.tooMany }, 429)

  const parsed = Body.safeParse(await readBody(req))
  if (!parsed.success) return refuse(address, 'malformed request', 400, MSG.badApp)
  const code = normalizeActivationCode(parsed.data.code)
  if (!code) return refuse(address, 'not a code', 400, MSG.badCode)
  const deviceName = cleanText(parsed.data.deviceName, 80)
  const appVersion = parsed.data.appVersion

  let r: Awaited<ReturnType<typeof activateInstall>>
  try {
    r = await activateInstall({ code, installId: parsed.data.installId, deviceName, appVersion })
  } catch (e) {
    if (e instanceof DesktopSetupError) return json({ message: MSG.notSetUp }, 503)
    // the first line only: never the query's parameters
    console.error('[desktop] activation failed:', e instanceof Error ? e.message.split('\n')[0] : 'error')
    return json({ message: MSG.failed }, 500)
  }
  if (!r.ok) return r.reason === 'expired' ? refuse(address, 'expired code', 410, MSG.expired) : refuse(address, 'unknown or used code', 404, MSG.unknown)

  // committed: from here on nothing may turn it into an error (audit() reports its own failures)
  const replaced = r.revokedRowIds.length ? ` (replaces #${r.revokedRowIds.join(', #')})` : ''
  await audit(
    'desktop app',
    r.retried ? 'desktop_activate_retry' : 'desktop_activate',
    `#${r.installRowId} ${r.label} · ${deviceName || 'unnamed computer'} · ${appVersion}${replaced}`,
  )
  return json({ key: r.key, label: r.label, siteUrl: siteAddress(req.headers.get('host')) })
}
