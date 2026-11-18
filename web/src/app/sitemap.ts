import type { MetadataRoute } from 'next'
import { getCommunityPosts, getEvents, getProducts } from '@/lib/data'

// built per request from the database, so new products and posts appear without a rebuild
export const dynamic = 'force-dynamic'

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://deadlydropspickleball.com') + (process.env.NEXT_PUBLIC_BASE_PATH || '')

/** Public pages only; account and checkout pages are noindex and left out, and members are hidden until real accounts exist. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, posts, events] = await Promise.all([getProducts(), getCommunityPosts(), getEvents()])
  const paths = [
    '/', '/tournaments/', '/charity/', '/about/', '/shop/', '/community/', '/gallery/', '/contact/',
    ...events.map((e) => `/tournaments/${e.slug}/`),
    ...products.map((p) => `/shop/${p.slug}/`),
    ...posts.map((p) => `/community/${p.slug}/`),
  ]
  return paths.map((p) => {
    const tournaments = p.startsWith('/tournaments/')
    // the site is about the tournaments and the charities they play for
    return { url: SITE + p, changeFrequency: tournaments ? 'weekly' : 'monthly', priority: p === '/' ? 1 : p === '/tournaments/' ? 0.9 : tournaments || p === '/charity/' ? 0.8 : 0.6 }
  })
}
