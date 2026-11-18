import type { Metadata } from 'next'
import { ShopCatalogue } from '@/components/ShopCatalogue'
import { AccentTitle } from '@/components/AccentTitle'
import { getPageCopy, getProducts, getShopSettings } from '@/lib/data'
import { pageMeta } from '@/lib/seo'

export const metadata: Metadata = pageMeta('Shop', 'Deadly Drops club shop: paddles, apparel and court gear. Buy at tournament check-in, or message us to hold one.', '/shop/')

export default async function ShopPage() {
  const [products, copy, { pickupNote }] = await Promise.all([getProducts(), getPageCopy('shop'), getShopSettings()])
  return (
    <section className="section dark">
      <div className="wrap">
        <div className="head-row" style={{ marginBottom: 0 }}>
          <div className="stack-16">
            {copy.eyebrow && <p className="eyebrow">{copy.eyebrow}</p>}
            <h1 className="display d-l"><AccentTitle title={copy.title} /></h1>
            <p className="lede">{copy.lede}</p>
          </div>
          <ul className="chips" style={{ listStyle: 'none', padding: 0 }}>
            {pickupNote && <li className="tag">{pickupNote}</li>}
          </ul>
        </div>
        <ShopCatalogue products={products} />
      </div>
    </section>
  )
}
