import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ProductDetail } from '@/components/ProductDetail'
import { getProduct, getProducts, memberDiscount } from '@/lib/data'

export async function generateStaticParams() {
  return (await getProducts()).map((p) => ({ slug: p.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const product = await getProduct((await params).slug)
  return { title: product ? product.name : 'Shop' }
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const product = await getProduct((await params).slug)
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
