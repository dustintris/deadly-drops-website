import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/auth/session'

/** Tournaments moved to /admin/tournaments/; old bookmarks land there. */
export default async function EventsMoved() {
  await requireAdmin() // each page checks: a layout check alone can be skipped by partial rendering
  redirect('/admin/tournaments/')
}
