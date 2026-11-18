import { audit } from '@/lib/audit'
import { can } from '@/lib/auth/permissions'
import { getSession } from '@/lib/auth/session'
import { listSignups, signupsCsv } from '@/lib/inbox/repo'

/** Admin → Inbox → "Download the list": the mailing list as CSV (needs "Website content: view"). */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const s = await getSession()
  if (!s) return new Response('Sign in to the admin again, then download the list.', { status: 401, headers: { 'Cache-Control': 'no-store' } })
  if (!can(s, 'content', 'view')) return new Response('Your login can’t see the email list.', { status: 403, headers: { 'Cache-Control': 'no-store' } })
  const rows = await listSignups()
  // the list is personal data: note who took a copy
  await audit(s.email, 'inbox_list_downloaded', `${rows.length} addresses`)
  const day = new Date().toISOString().slice(0, 10)
  // the byte-order mark makes Excel read the file as UTF-8
  return new Response(`\ufeff${signupsCsv(rows)}`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="ddp-email-list-${day}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
