import { findUsage } from '@/lib/media-usage'
import { MediaLibraryProvider } from '@/components/admin/kit'
import { getAdminData } from '@/lib/admin-data'
import { MediaManager, type BundledPhoto, type UploadedPhoto } from './MediaManager'
import { requireAdmin } from '@/lib/auth/session'

export const metadata = { title: 'Photos' }

export default async function MediaAdmin() {
  await requireAdmin() // each page checks: a layout check alone can be skipped by partial rendering
  const { draft, library } = await getAdminData()
  const uploads: UploadedPhoto[] = await Promise.all(
    [...draft.media]
      .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))
      .map(async (m) => ({
        id: m.id, src: `/media/${m.file}`, alt: m.alt, width: m.width, height: m.height, bytes: m.bytes, uploadedAt: m.uploadedAt,
        usedBy: await findUsage(`/media/${m.file}`, draft),
      })),
  )
  const bundled: BundledPhoto[] = await Promise.all(
    library
      .filter((img) => !img.src.startsWith('/media/'))
      .map(async (img) => ({
        src: img.src,
        name: img.label,
        kind: img.stand ? 'Stock stand-in, replace before launch' : img.src.startsWith('/images/club/') ? 'Club photo' : 'Club crest',
        stand: !!img.stand,
        usedBy: await findUsage(img.src, draft),
      })),
  )
  return (
    <MediaLibraryProvider initial={library}>
      <div className="adm-head">
        <div>
          <h1>Photos</h1>
          <p className="adm-muted">Upload photos here, then pick them on any page, product or gallery item. Each photo needs a short description for people using screen readers.</p>
        </div>
      </div>
      <MediaManager uploads={uploads} bundled={bundled} />
    </MediaLibraryProvider>
  )
}
