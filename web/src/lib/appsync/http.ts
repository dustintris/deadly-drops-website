import 'server-only'
import { bearerKey, verifyAppKey } from './key'

const HEADERS = { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' }

export const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: HEADERS })

/** null when the request carries the current desktop app key, else the 401 to send. */
export async function refuseWithoutKey(req: Request): Promise<Response | null> {
  if (await verifyAppKey(bearerKey(req.headers.get('authorization')))) return null
  return new Response(JSON.stringify({ message: 'Invalid or missing key. Make one in Admin → Desktop app.' }), {
    status: 401,
    headers: { ...HEADERS, 'WWW-Authenticate': 'Bearer' },
  })
}

export const noPublish = () =>
  json({ message: 'Publishing from the desktop app isn’t supported yet. Set the tournament up on the website instead.' }, 405)
