import { toSummary } from '@/lib/appsync/export'
import { json, noPublish, refuseWithoutKey } from '@/lib/appsync/http'
import { loadAllForApp } from '@/lib/appsync/load'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/tournaments/ — the desktop Pickle Match app's tournament list (Authorization: Bearer <key>
 * from Admin → Desktop app). Same contract as the app's own registration server.
 */
export async function GET(req: Request) {
  const refused = await refuseWithoutKey(req)
  if (refused) return refused
  return json({ tournaments: (await loadAllForApp()).map(toSummary) })
}

export async function POST(req: Request) {
  return (await refuseWithoutKey(req)) ?? noPublish()
}
