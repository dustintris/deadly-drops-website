import Link from 'next/link'
import type { CommunityPostT } from '@/lib/content-schema'
import { asset, cx } from '@/lib/utils'
import styles from './community.module.css'

export const KIND_LABEL: Record<CommunityPostT['kind'], string> = {
  news: 'News',
  article: 'Article',
  'photo-story': 'Photo story',
}

/** "2026-03-14" → "Mar 14, 2026" (fixed time zone, so server and browser agree). */
export function postDate(iso: string) {
  const d = new Date(`${iso}T12:00:00Z`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

export const postHref = (p: Pick<CommunityPostT, 'slug'>) => `/community/${p.slug}/`

type Props = { post: CommunityPostT; headingLevel?: 'h2' | 'h3'; showAuthor?: boolean }

/** Card used in the Articles & stories grid and in "More from the community". */
export function PostCard({ post, headingLevel = 'h3', showAuthor = true }: Props) {
  const H = headingLevel
  return (
    <article className={cx('card card-link', styles.card)}>
      <Link href={postHref(post)} className={styles.cardLink}>
        <div className={cx('photo', styles.cardPhoto)}>
          {post.cover ? (
            <img src={asset(post.cover.src)} alt={post.cover.alt} loading="lazy" style={{ objectPosition: post.cover.position ?? '50% 50%' }} />
          ) : (
            <span className={styles.cardPlaceholder} aria-hidden="true">{KIND_LABEL[post.kind]}</span>
          )}
        </div>
        <div className={styles.cardBody}>
          <p className="eyebrow">{KIND_LABEL[post.kind]}{post.photos.length > 0 && ` · ${post.photos.length} photo${post.photos.length === 1 ? '' : 's'}`}</p>
          <H className={styles.cardTitle}>{post.title}</H>
          <p className={cx('muted', styles.cardExcerpt)}>{post.excerpt}</p>
          <p className={styles.meta}>
            <time dateTime={post.publishedAt}>{postDate(post.publishedAt)}</time>
            {showAuthor && <span>{post.author}</span>}
          </p>
        </div>
      </Link>
    </article>
  )
}
