import { findActiveInstall } from '@/lib/appsync/installs'
import { bearerKey } from '@/lib/appsync/key'
import { downloadPathAllowed } from '@/lib/appsync/release'
import { can } from '@/lib/auth/permissions'
import { getSession } from '@/lib/auth/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/desktop/download-check/ — asked by Caddy (forward_auth) before it serves anything under
 * /downloads/desktop/, with the visitor's own headers. 204 lets the download through: an activated computer's key
 * (the app's updater), or a signed-in staff manager (the admin's download link). 401 otherwise, 403 for any other
 * path. Never a redirect: Caddy would hand it to the visitor.
 */
const answer = (status: 204 | 401 | 403) => new Response(null, { status, headers: { 'Cache-Control': 'no-store' } })

export async function GET(req: Request) {
  if (!downloadPathAllowed(req.headers.get('x-forwarded-uri'))) return answer(403)
  const key = bearerKey(req.headers.get('authorization'))
  if (key && (await findActiveInstall(key))) return answer(204)
  const s = await getSession()
  return s && can(s, 'staff', 'edit') ? answer(204) : answer(401)
}
