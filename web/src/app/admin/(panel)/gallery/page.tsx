import { EditGate, MediaLibraryProvider } from '@/components/admin/kit'
import { getAdminData } from '@/lib/admin-data'
import { GalleryEditor } from './GalleryEditor'
import { can } from '@/lib/auth/permissions'
import { requirePermission } from '@/lib/auth/session'

export const metadata = { title: 'Gallery' }

export default async function GalleryAdmin() {
  const s = await requirePermission('content', 'view') // each page checks: a layout check alone can be skipped by partial rendering
  const { draft, library } = await getAdminData()
  return (
    <MediaLibraryProvider initial={library}>
      <div className="adm-head">
        <div>
          <h1>Gallery</h1>
          <p className="adm-muted">Photos on the Gallery page, in this order. Photos in the Community and Socials albums also appear on the Community page.</p>
        </div>
      </div>
      <EditGate canEdit={can(s, 'content', 'edit')}>
        <GalleryEditor initial={draft.gallery} rev={draft.rev} />
      </EditGate>
    </MediaLibraryProvider>
  )
}
