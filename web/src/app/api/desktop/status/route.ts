import { json, noteInstallSeen } from '@/lib/appsync/http'
import { findActiveInstall } from '@/lib/appsync/installs'
import { bearerKey } from '@/lib/appsync/key'
import { readLatestVersion } from '@/lib/appsync/release'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/desktop/status/ (Authorization: Bearer <install key>, X-App-Version) — is this computer still activated,
 * and which version does the update feed offer? The app treats a 401 as "revoked", so a 401 is sent ONLY for a key
 * that is unknown or revoked; anything going wrong on the server is a 5xx (the app then counts as offline).
 */
export async function GET(req: Request) {
  let install: { id: number; label: string } | null
  try {
    install = await findActiveInstall(bearerKey(req.headers.get('authorization')))
  } catch (e) {
    console.error('[desktop] status check failed:', e instanceof Error ? e.message.split('\n')[0] : 'error')
    return json({ message: 'The website couldn’t check this computer right now. Try again later.' }, 503)
  }
  if (!install) {
    return json(
      { active: false, message: 'This computer isn’t activated any more. Ask for a new activation code from Admin → Desktop app on the website.' },
      401,
      { 'WWW-Authenticate': 'Bearer' },
    )
  }
  await noteInstallSeen(install.id, req)
  return json({ active: true, label: install.label, latestVersion: await readLatestVersion() })
}
