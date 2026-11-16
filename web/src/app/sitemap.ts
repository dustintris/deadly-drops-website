import type { MetadataRoute } from 'next'
import { getCommunityPosts, getEvents, getMembers, getProducts } from '@/lib/data'

// built per request from the database, so new products and posts appear without a rebuild
export const dynamic = 'force-dynamic'

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://deadlydropspickleball.com') + (process.env.NEXT_PUBLIC_BASE_PATH || '')

/** Public pages only; account and checkout pages are noindex and left out. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [members, products, posts, events] = await Promise.all([getMembers(), getProducts(), getCommunityPosts(), getEvents()])
  const paths = [
    '/', '/tournaments/', '/about/', '/members/', '/shop/', '/community/', '/gallery/', '/contact/',
    ...events.map((e) => `/tournaments/${e.slug}/`),
    ...members.map((m) => `/members/${m.slug}/`),
    ...products.map((p) => `/shop/${p.slug}/`),
    ...posts.map((p) => `/community/${p.slug}/`),
  ]
  return paths.map((p) => {
    const tournaments = p.startsWith('/tournaments/')
    return { url: SITE + p, changeFrequency: tournaments ? 'weekly' : 'monthly', priority: p === '/' ? 1 : p === '/tournaments/' ? 0.9 : tournaments ? 0.8 : 0.6 }
  })
}
