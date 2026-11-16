import 'server-only'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import { getSession } from '@/lib/auth/session'
import { publicPlay } from '@/lib/data'
import { getTournamentPlay } from '@/lib/play/repo'
import { ensureImported, getTournamentBySlug } from '@/lib/tournaments/repo'

/**
 * A tournament for the venue screen and printable results. Visible tournaments are public (the same
 * as their page); a hidden one is only for signed-in staff, and anyone else gets a plain 404 so its
 * existence isn't given away (the same rule as the live feed). Check-in details never leave here.
 */
export const loadDisplay = cache(async (slug: string) => {
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) notFound()
  await ensureImported()
  const t = await getTournamentBySlug(slug)
  if (!t || (!t.visible && !(await getSession()))) notFound()
  const play = await getTournamentPlay(t.id)
  if (!play) notFound()
  return { tournament: t, play: publicPlay(play) }
})
