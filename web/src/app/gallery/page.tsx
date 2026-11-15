import type { Metadata } from 'next'
import Link from 'next/link'
import { GalleryGrid } from '@/components/GalleryGrid'
import { getGallery } from '@/lib/data'

export const metadata: Metadata = { title: 'Gallery' }

export default async function GalleryPage() {
  const items = await getGallery()
  return (
    <section className="section dark">
      <div className="wrap">
        <div className="head-row">
          <div className="stack-16">
            <p className="eyebrow">Gallery</p>
            <h1 className="display d-l">Our time on court</h1>
            <p className="lede">Shot by members, mostly on phones. Send us yours, tag the event, and we&rsquo;ll add them.</p>
          </div>
          <Link href="/contact/" className="btn btn-line">Submit a photo</Link>
        </div>
        <GalleryGrid items={items} />
      </div>
    </section>
  )
}
