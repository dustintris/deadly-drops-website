import type { MetadataRoute } from 'next'
import { getCommunityPosts, getMembers, getProducts } from '@/lib/data'

// built per request from the database, so new products and posts appear without a rebuild
export const dynamic = 'force-dynamic'

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://deadlydropspickleball.com') + (process.env.NEXT_PUBLIC_BASE_PATH || '')

/** Public pages only; account and checkout pages are noindex and left out. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [members, products, posts] = await Promise.all([getMembers(), getProducts(), getCommunityPosts()])
  const paths = [
    '/', '/tournaments/', '/about/', '/members/', '/shop/', '/community/', '/gallery/', '/contact/',
    ...members.map((m) => `/members/${m.slug}/`),
    ...products.map((p) => `/shop/${p.slug}/`),
    ...posts.map((p) => `/community/${p.slug}/`),
  ]
  return paths.map((p) => ({ url: SITE + p, changeFrequency: p === '/tournaments/' ? 'weekly' : 'monthly', priority: p === '/' ? 1 : p === '/tournaments/' ? 0.9 : 0.6 }))
}
