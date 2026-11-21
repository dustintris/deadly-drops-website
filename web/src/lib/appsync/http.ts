import 'server-only'
import { cleanAppVersion } from './codes'
import { findActiveInstall, touchInstall } from './installs'
import { bearerKey, verifyAppKey } from './key'

const HEADERS = { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' }

export const json = (body: unknown, status = 200, extra?: Record<string, string>) =>
  new Response(JSON.stringify(body), { status, headers: extra ? { ...HEADERS, ...extra } : HEADERS })

/** Note an install's visit without ever failing the request it came with. */
export async function noteInstallSeen(id: number, req: Request): Promise<void> {
  try {
    await touchInstall(id, cleanAppVersion(req.headers.get('x-app-version')))
  } catch (e) {
    console.error('[desktop] could not note last seen:', e instanceof Error ? e.message.split('\n')[0] : 'error')
  }
}

/**
 * null when the request carries a key that may download tournaments, else the 401 to send. Either the older shared
 * key (apps from before activation) or an activated computer's own key, whose last-seen is noted.
 */
export async function refuseWithoutKey(req: Request): Promise<Response | null> {
  const key = bearerKey(req.headers.get('authorization'))
  if (await verifyAppKey(key)) return null
  const install = await findActiveInstall(key)
  if (install) {
    await noteInstallSeen(install.id, req)
    return null
  }
  return json({ message: 'Invalid or missing key. Activate this computer from Admin → Desktop app on the website.' }, 401, {
    'WWW-Authenticate': 'Bearer',
  })
}

export const noPublish = () =>
  json({ message: 'Publishing from the desktop app isn’t supported yet. Set the tournament up on the website instead.' }, 405)
