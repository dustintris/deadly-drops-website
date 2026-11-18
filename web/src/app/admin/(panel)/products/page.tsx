import Link from 'next/link'
import { EditGate, MediaLibraryProvider } from '@/components/admin/kit'
import { getAdminData } from '@/lib/admin-data'
import { ProductsEditor } from './ProductsEditor'
import { can } from '@/lib/auth/permissions'
import { requirePermission } from '@/lib/auth/session'

export const metadata = { title: 'Shop & prices' }

export default async function ProductsAdmin() {
  const s = await requirePermission('shop', 'view') // each page checks: a layout check alone can be skipped by partial rendering
  const { draft, library } = await getAdminData()
  // the shop is a catalogue (no online checkout): the "how to buy" note is what visitors act on
  const pickupNote = draft.settings.shop.pickupNote
  return (
    <MediaLibraryProvider initial={library}>
      <div className="adm-head">
        <div>
          <h1>Shop &amp; prices</h1>
          <p className="adm-muted">Products appear in the shop in this order. Hidden products stay here but are not shown on the site.</p>
        </div>
      </div>
      <div className="adm-card" style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <p style={{ marginRight: 'auto' }}>
          The shop has no online checkout. Each product says how to buy:{' '}
          {pickupNote ? <strong>“{pickupNote}”</strong> : <em>no note yet</em>}, with a button to message the club about it.
        </p>
        {/* the note lives in Club info, which is website content */}
        {can(s, 'content', 'edit') && <Link className="adm-btn" href="/admin/settings/">Change how to buy</Link>}
      </div>
      <EditGate canEdit={can(s, 'shop', 'edit')}>
        <ProductsEditor initial={draft.products} rev={draft.rev} />
      </EditGate>
    </MediaLibraryProvider>
  )
}
