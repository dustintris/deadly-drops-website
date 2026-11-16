import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { GalleryGrid } from '@/components/GalleryGrid'
import { KIND_LABEL, PostCard, postDate } from '@/components/PostCard'
import c from '@/components/community.module.css'
import type { CommunityPostT } from '@/lib/content-schema'
import { getCommunityPost, getCommunityPosts } from '@/lib/data'
import { RichText } from '@/lib/richtext'
import { pageMeta } from '@/lib/seo'
import type { GalleryItem } from '@/lib/types'
import { asset } from '@/lib/utils'

type Params = { params: Promise<{ slug: string }> }

/** Search descriptions read best at 120–160 characters: trim long summaries, extend short ones. */
function describe(post: CommunityPostT) {
  const base = post.excerpt.replace(/\s+/g, ' ').trim()
  if (base.length > 160) {
    const cut = base.slice(0, 157)
    return cut.slice(0, cut.lastIndexOf(' ') > 100 ? cut.lastIndexOf(' ') : 157).replace(/[\s,.;:!?-]+$/, '') + '…'
  }
  if (base.length >= 120) return base
  const end = /[.!?]$/.test(base) ? '' : '.'
  const suffix = ` ${KIND_LABEL[post.kind]} from the Deadly Drops Pickleball community in Chula Vista, CA.`
  return (base + end + suffix).slice(0, 160)
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const slug = (await params).slug
  const post = await getCommunityPost(slug)
  if (!post) return { title: 'Community' }
  return pageMeta(post.title, describe(post), `/community/${slug}/`)
}

const toItems = (post: CommunityPostT): GalleryItem[] =>
  post.photos.map((img, i) => ({
    id: `${post.id}-${i}`,
    caption: img.alt || `${post.title}, photo ${i + 1}`,
    meta: postDate(post.publishedAt),
    album: 'Community',
    src: img.src,
    position: img.position ?? '50% 50%',
    alt: img.alt,
    shotBy: post.author,
  }))

export default async function PostPage({ params }: Params) {
  const slug = (await params).slug
  const [post, all] = await Promise.all([getCommunityPost(slug), getCommunityPosts()])
  if (!post) notFound()

  const others = all.filter((p) => p.id !== post.id)
  // prefer posts of the same kind, then fill with the newest of the rest
  const more = [...others.filter((p) => p.kind === post.kind), ...others.filter((p) => p.kind !== post.kind)].slice(0, 3)
  const photos = toItems(post)

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': post.kind === 'news' ? 'NewsArticle' : 'Article',
    headline: post.title,
    description: post.excerpt,
    datePublished: post.publishedAt,
    author: { '@type': 'Person', name: post.author },
    ...(post.cover ? { image: asset(post.cover.src) } : {}),
    ...(post.tags.length ? { keywords: post.tags.join(', ') } : {}),
  }

  return (
    <>
      <article className="section dark">
        <div className="wrap">
          <div className={c.post}>
            <Link href="/community/" className={c.back}>← All community posts</Link>
            <header className={c.postHead}>
              <p className={c.meta}>
                <span className="accent">{KIND_LABEL[post.kind]}</span>
                <time dateTime={post.publishedAt}>{postDate(post.publishedAt)}</time>
                <span>By {post.author}</span>
              </p>
              <h1 className="display d-l">{post.title}</h1>
              <p className={c.postExcerpt}>{post.excerpt}</p>
            </header>

            {post.cover && (
              <figure className={c.cover}>
                <img src={asset(post.cover.src)} alt={post.cover.alt} style={{ objectPosition: post.cover.position ?? '50% 50%' }} />
              </figure>
            )}

            <RichText source={post.body} className={c.prose} />

            {post.tags.length > 0 && (
              <ul className={c.tags} aria-label="Tags">
                {post.tags.map((t) => <li key={t} className="tag">{t}</li>)}
              </ul>
            )}
          </div>

          {photos.length > 0 && (
            <section className={c.photos} aria-labelledby="post-photos">
              <h2 id="post-photos" className="display d-m">Photos</h2>
              <GalleryGrid items={photos} />
            </section>
          )}
        </div>
      </article>

      {more.length > 0 && (
        <section className="section darker rule-top" aria-labelledby="more-title">
          <div className="wrap">
            <div className="head-row">
              <h2 id="more-title" className="display d-m">More from the community</h2>
              <Link href="/community/" className="link-arrow">All posts →</Link>
            </div>
            <ul className={c.cards}>
              {more.map((p) => <li key={p.id}><PostCard post={p} /></li>)}
            </ul>
          </div>
        </section>
      )}

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
    </>
  )
}
