import { toImportFormat } from '@/lib/appsync/export'
import { json, refuseWithoutKey } from '@/lib/appsync/http'
import { loadForApp } from '@/lib/appsync/load'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** GET /api/tournaments/<id>/ — one tournament in the desktop app's import format. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const refused = await refuseWithoutKey(req)
  if (refused) return refused
  const raw = (await params).id
  const id = /^\d{1,9}$/.test(raw) ? Number(raw) : 0
  const t = id > 0 ? await loadForApp(id) : null
  if (!t) return json({ message: 'Tournament not found' }, 404)
  return json(toImportFormat(t))
}
