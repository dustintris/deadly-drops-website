import type { MetadataRoute } from 'next'
import { getMembers, getProducts } from '@/lib/data'

export const dynamic = 'force-static'

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://deadlydropspickleball.com') + (process.env.NEXT_PUBLIC_BASE_PATH || '')

/** Public pages only; account and checkout pages are noindex and left out. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [members, products] = await Promise.all([getMembers(), getProducts()])
  const paths = [
    '/', '/tournaments/', '/about/', '/members/', '/shop/', '/gallery/', '/contact/',
    ...members.map((m) => `/members/${m.slug}/`),
    ...products.map((p) => `/shop/${p.slug}/`),
  ]
  return paths.map((p) => ({ url: SITE + p, changeFrequency: p === '/tournaments/' ? 'weekly' : 'monthly', priority: p === '/' ? 1 : p === '/tournaments/' ? 0.9 : 0.6 }))
}
