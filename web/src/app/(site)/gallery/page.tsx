import type { Metadata } from 'next'
import Link from 'next/link'
import { GalleryGrid } from '@/components/GalleryGrid'
import { AccentTitle } from '@/components/AccentTitle'
import { getGallery, getPageCopy } from '@/lib/data'
import { pageMeta } from '@/lib/seo'

export const metadata: Metadata = pageMeta('Gallery', 'Photos from Deadly Drops Pickleball tournaments, ladder nights, clinics and socials in Chula Vista, CA. Send us yours to add.', '/gallery/')

export default async function GalleryPage({ searchParams }: { searchParams: Promise<{ album?: string | string[] }> }) {
  const [items, copy, query] = await Promise.all([getGallery(), getPageCopy('gallery'), searchParams])
  // ?album=Tournaments opens the grid on that album (an unknown one is simply ignored)
  const album = typeof query.album === 'string' ? query.album : undefined
  return (
    <section className="section dark">
      <div className="wrap">
        <div className="head-row">
          <div className="stack-16">
            {copy.eyebrow && <p className="eyebrow">{copy.eyebrow}</p>}
            <h1 className="display d-l"><AccentTitle title={copy.title} /></h1>
            {copy.lede && <p className="lede">{copy.lede}</p>}
          </div>
          <Link href="/contact/" className="btn btn-line">Submit a photo</Link>
        </div>
        <GalleryGrid items={items} initialAlbum={album} />
      </div>
    </section>
  )
}
