import type { MetadataRoute } from 'next'

export const dynamic = 'force-static'

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://deadlydropspickleball.com') + (process.env.NEXT_PUBLIC_BASE_PATH || '')

export default function robots(): MetadataRoute.Robots {
  return {
    // account pages carry noindex instead of a Disallow, so crawlers can read that tag
    rules: { userAgent: '*', allow: '/' },
    sitemap: `${SITE}/sitemap.xml`,
  }
}
