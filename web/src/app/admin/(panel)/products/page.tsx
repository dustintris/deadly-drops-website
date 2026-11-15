import Link from 'next/link'
import { MediaLibraryProvider } from '@/components/admin/kit'
import { getAdminData } from '@/lib/admin-data'
import { ProductsEditor } from './ProductsEditor'

export const metadata = { title: 'Shop & prices' }

export default async function ProductsAdmin() {
  const { draft, library } = await getAdminData()
  const discount = Math.round(draft.settings.shop.memberDiscount * 100)
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
          Members currently get <strong>{discount}% off</strong> every product.
        </p>
        <Link className="adm-btn" href="/admin/settings/">Change the member discount</Link>
      </div>
      <ProductsEditor initial={draft.products} rev={draft.rev} />
    </MediaLibraryProvider>
  )
}
