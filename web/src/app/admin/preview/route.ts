import { draftMode } from 'next/headers'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'

/** /admin/preview/?on=1&path=/tournaments/ → view the site with unpublished changes (owner only). */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const on = url.searchParams.get('on') !== '0'
  const raw = url.searchParams.get('path') ?? '/'
  // internal paths only: no scheme, no //host, no backslashes
  const path = /^\/(?!\/)[a-z0-9/_#-]*$/i.test(raw) ? raw : '/'
  const dm = await draftMode()
  if (!on) {
    dm.disable()
    redirect(path)
  }
  if (!(await getSession())) redirect('/admin/login/')
  dm.enable()
  redirect(path)
}
