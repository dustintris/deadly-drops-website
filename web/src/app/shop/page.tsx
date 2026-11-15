import type { Metadata } from 'next'
import { ShopCatalogue } from '@/components/ShopCatalogue'
import { getProducts, memberDiscount } from '@/lib/data'

export const metadata: Metadata = { title: 'Shop' }

export default async function ShopPage() {
  const products = await getProducts()
  return (
    <section className="section dark">
      <div className="wrap">
        <div className="head-row" style={{ marginBottom: 0 }}>
          <div className="stack-16">
            <h1 className="display d-l">Wear the drop</h1>
            <p className="lede">
              Club kit, paddles and the small stuff you forgot in the car. Members get {Math.round(memberDiscount * 100)}% off
              everything at checkout.
            </p>
          </div>
          <ul className="chips" style={{ listStyle: 'none', padding: 0 }}>
            <li className="tag">Free pickup at the courts</li>
            <li className="tag">Ships in 3–5 days</li>
          </ul>
        </div>
        <ShopCatalogue products={products} />
      </div>
    </section>
  )
}
