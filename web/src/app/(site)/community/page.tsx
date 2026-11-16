import type { Metadata } from 'next'
import Link from 'next/link'
import { GalleryGrid } from '@/components/GalleryGrid'
import { PageHero } from '@/components/PageHero'
import { KIND_LABEL, PostCard, postDate, postHref } from '@/components/PostCard'
import c from '@/components/community.module.css'
import { accentSegments } from '@/lib/content-schema'
import { getCommunityPhotos, getCommunityPosts, getPageCopy } from '@/lib/data'
import { pageMeta } from '@/lib/seo'
import { asset, cx } from '@/lib/utils'

export const metadata: Metadata = pageMeta(
  'Community',
  'Club news, player stories and photos from Deadly Drops Pickleball tournaments, ladder nights and socials in Chula Vista, CA. Share yours with us.',
  '/community/',
)

const FALLBACK_COPY = {
  eyebrow: 'Community',
  title: 'The people who *make* the club',
  lede: 'Photos from the courts, club news and stories from the players who keep showing up.',
}

export default async function CommunityPage() {
  const [copy, posts, photos] = await Promise.all([getPageCopy('community'), getCommunityPosts(), getCommunityPhotos()])
  const page = copy ?? FALLBACK_COPY
  const news = posts.filter((p) => p.kind === 'news')
  const stories = posts.filter((p) => p.kind !== 'news')
  const featured = posts.find((p) => p.featured) ?? stories[0] ?? null
  // keep the featured story out of the grid unless it would leave the grid empty
  const grid = stories.length > 1 ? stories.filter((p) => p.id !== featured?.id) : stories

  return (
    <>
      <PageHero
        eyebrow={page.eyebrow || undefined}
        title={accentSegments(page.title).map((s, i) => (s.accent ? <span key={i} className="accent">{s.text}</span> : s.text))}
        lede={page.lede || undefined}
        photo={copy?.heroImage?.src}
        photoPosition={copy?.heroImage?.position}
      />

      {featured && (
        <section className="section-tight darker" aria-labelledby="featured-title">
          <div className="wrap">
            <article className={cx('card', c.featured)}>
              <Link href={postHref(featured)} className={cx('photo', c.featuredPhoto)} tabIndex={-1} aria-hidden="true">
                {featured.cover ? (
                  <img src={asset(featured.cover.src)} alt="" style={{ objectPosition: featured.cover.position ?? '50% 50%' }} />
                ) : (
                  <span className={c.cardPlaceholder}>{KIND_LABEL[featured.kind]}</span>
                )}
              </Link>
              <div className={c.featuredBody}>
                <p className="eyebrow">Featured {KIND_LABEL[featured.kind].toLowerCase()}</p>
                <h2 id="featured-title" className="display d-m">
                  <Link href={postHref(featured)}>{featured.title}</Link>
                </h2>
                <p className="lede">{featured.excerpt}</p>
                <p className={c.meta}>
                  <time dateTime={featured.publishedAt}>{postDate(featured.publishedAt)}</time>
                  <span>{featured.author}</span>
                </p>
                <div>
                  <Link href={postHref(featured)} className="btn btn-accent">
                    {featured.kind === 'photo-story' ? 'See the photos' : 'Read the story'}<span className="sr">: {featured.title}</span>
                  </Link>
                </div>
              </div>
            </article>
          </div>
        </section>
      )}

      <section className="section dark" aria-labelledby="news-title">
        <div className="wrap">
          <div className="head-row">
            <div className="stack-8">
              <p className="eyebrow">Club news</p>
              <h2 id="news-title" className="display d-m">News</h2>
            </div>
          </div>
          {news.length ? (
            <ul className={c.news}>
              {news.map((p) => (
                <li key={p.id}>
                  <Link href={postHref(p)} className={c.newsLink}>
                    <time className={c.newsDate} dateTime={p.publishedAt}>{postDate(p.publishedAt)}</time>
                    <h3 className={c.newsTitle}>{p.title}</h3>
                    <p className={c.newsExcerpt}>{p.excerpt}</p>
                    <span className={c.newsArrow} aria-hidden="true">→</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className={c.empty}>No news yet. Check back after the next event.</p>
          )}
        </div>
      </section>

      <section className="section darker rule-top" aria-labelledby="stories-title">
        <div className="wrap">
          <div className="head-row">
            <div className="stack-8">
              <p className="eyebrow">From the players</p>
              <h2 id="stories-title" className="display d-m">Articles &amp; stories</h2>
            </div>
          </div>
          {grid.length ? (
            <ul className={c.cards}>
              {grid.map((p) => <li key={p.id}><PostCard post={p} /></li>)}
            </ul>
          ) : (
            <p className={c.empty}>No stories yet. Played a memorable match or ran your first tournament? Tell us about it.</p>
          )}
        </div>
      </section>

      <section className="section dark rule-top" aria-labelledby="photos-title">
        <div className="wrap">
          <div className="head-row">
            <div className="stack-8">
              <p className="eyebrow">On and off court</p>
              <h2 id="photos-title" className="display d-m">Community photos</h2>
            </div>
            <Link href="/gallery/" className="link-arrow">See the full gallery →</Link>
          </div>
          {photos.length ? (
            <GalleryGrid items={photos} />
          ) : (
            <p className={c.empty}>No community photos yet. Send us yours from the next social and we&rsquo;ll add them here.</p>
          )}
        </div>
      </section>

      <section className="section-tight darker">
        <div className="wrap">
          <div className={c.share}>
            <div className="stack-8">
              <h2 className="display d-s">Got photos or a story?</h2>
              <p className="muted">Send us your shots from the courts, a write-up of your best match, or news the club should know about. A member reads every message.</p>
            </div>
            <Link href="/contact/" className="btn btn-accent">Share with us</Link>
          </div>
        </div>
      </section>
    </>
  )
}
