import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ProductDetail } from '@/components/ProductDetail'
import { getProduct, getShopSettings } from '@/lib/data'
import { pageMeta } from '@/lib/seo'
import { money } from '@/lib/utils'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const slug = (await params).slug
  const product = await getProduct(slug)
  if (!product) return { title: 'Shop' }
  return pageMeta(product.name, `${product.name} (${product.sub}), ${money(product.price)} from the Deadly Drops club shop. Deadly Drops Pickleball™ apparel from Chula Vista, CA.`, `/shop/${slug}/`)
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const [product, { pickupNote }] = await Promise.all([getProduct((await params).slug), getShopSettings()])
  if (!product) notFound()
  return (
    <section className="section light">
      <div className="wrap">
        <p style={{ marginBottom: 24 }}><Link href="/shop/" className="mono small">← All products</Link></p>
        <ProductDetail product={product} pickupNote={pickupNote} />
      </div>
    </section>
  )
}
