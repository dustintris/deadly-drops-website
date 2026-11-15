import type { Metadata } from 'next'
import Link from 'next/link'
import { GalleryGrid } from '@/components/GalleryGrid'
import { getGallery } from '@/lib/data'
import { pageMeta } from '@/lib/seo'

export const metadata: Metadata = pageMeta('Gallery', 'Photos from Deadly Drops Pickleball tournaments, ladder nights, clinics and socials in Chula Vista, CA. Send us yours to add.', '/gallery/')

export default async function GalleryPage() {
  const items = await getGallery()
  return (
    <section className="section dark">
      <div className="wrap">
        <div className="head-row">
          <div className="stack-16">
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
