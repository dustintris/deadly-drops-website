import type { Metadata } from 'next'
import { CartView } from '@/components/CartView'
import { memberDiscount } from '@/lib/data'
import { pageMeta } from '@/lib/seo'

export const metadata: Metadata = pageMeta('Cart', 'Your Deadly Drops shop cart.', '/cart/', { noindex: true })

export default function CartPage() {
  return (
    <section className="section dark">
      <div className="wrap">
        <CartView discount={memberDiscount} />
      </div>
    </section>
  )
}
