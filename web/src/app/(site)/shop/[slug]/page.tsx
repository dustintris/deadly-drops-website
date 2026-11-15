import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ProductDetail } from '@/components/ProductDetail'
import { getProduct, getProducts, getMemberDiscount } from '@/lib/data'
import { pageMeta } from '@/lib/seo'
import { money } from '@/lib/utils'

export async function generateStaticParams() {
  return (await getProducts()).map((p) => ({ slug: p.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const slug = (await params).slug
  const product = await getProduct(slug)
  if (!product) return { title: 'Shop' }
  return pageMeta(product.name, `${product.name} (${product.sub}), ${money(product.price)} from the Deadly Drops club shop. Free pickup at the courts in Chula Vista, member discount at checkout.`, `/shop/${slug}/`)
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const [product, memberDiscount] = await Promise.all([getProduct((await params).slug), getMemberDiscount()])
  if (!product) notFound()
  return (
    <section className="section light">
      <div className="wrap">
        <p style={{ marginBottom: 24 }}><Link href="/shop/" className="mono small">← All products</Link></p>
        <ProductDetail product={product} discount={memberDiscount} />
      </div>
    </section>
  )
}
