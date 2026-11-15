import { MediaLibraryProvider } from '@/components/admin/kit'
import { getAdminData } from '@/lib/admin-data'
import { PagesEditor } from './PagesEditor'

export const metadata = { title: 'Page text' }

export default async function PagesAdmin() {
  const { draft, library } = await getAdminData()
  return (
    <MediaLibraryProvider initial={library}>
      <div className="adm-head">
        <div>
          <h1>Page text</h1>
          <p className="adm-muted">The headline, intro and main photo at the top of each page.</p>
        </div>
      </div>
      <PagesEditor initial={draft.pages} />
    </MediaLibraryProvider>
  )
}
