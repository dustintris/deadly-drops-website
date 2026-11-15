import type { Metadata } from 'next'
import { CartView } from '@/components/CartView'
import { memberDiscount } from '@/lib/data'

export const metadata: Metadata = { title: 'Cart' }

export default function CartPage() {
  return (
    <section className="section dark">
      <div className="wrap">
        <CartView discount={memberDiscount} />
      </div>
    </section>
  )
}
