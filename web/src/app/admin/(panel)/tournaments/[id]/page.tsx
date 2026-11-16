import { notFound } from 'next/navigation'
import { EditGate, MediaLibraryProvider } from '@/components/admin/kit'
import { getAdminData } from '@/lib/admin-data'
import { can } from '@/lib/auth/permissions'
import { requirePermission } from '@/lib/auth/session'
import { ensureImported, getTournament } from '@/lib/tournaments/repo'
import { LeaveLink, TournamentEditor } from './TournamentEditor'

export const metadata = { title: 'Tournament' }
export const dynamic = 'force-dynamic'

export default async function TournamentAdmin({ params }: { params: Promise<{ id: string }> }) {
  const s = await requirePermission('tournaments', 'view') // each page checks: a layout check alone can be skipped by partial rendering
  const { id: raw } = await params
  const id = /^\d{1,9}$/.test(raw ?? '') ? Number(raw) : 0
  if (id <= 0) notFound()
  await ensureImported()
  const [tournament, { library }] = await Promise.all([getTournament(id), getAdminData()])
  if (!tournament) notFound()
  const canEdit = can(s, 'tournaments', 'edit')
  return (
    <MediaLibraryProvider initial={library}>
      <div className="adm-head">
        <div style={{ display: 'grid', gap: 8 }}>
          <p style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 20px' }}>
            <LeaveLink href="/admin/tournaments/">← All tournaments</LeaveLink>
            <LeaveLink href={`/admin/tournaments/${tournament.id}/play/`}>Teams &amp; schedule →</LeaveLink>
          </p>
          <h1>{tournament.name}</h1>
          <p className="adm-muted">Saved changes show on the website straight away while “Show on the website” is ticked.</p>
        </div>
      </div>
      <EditGate canEdit={canEdit}>
        <TournamentEditor initial={tournament} canEdit={canEdit} />
      </EditGate>
    </MediaLibraryProvider>
  )
}
