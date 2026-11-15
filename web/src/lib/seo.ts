import type { Metadata } from 'next'

/**
 * Per-page metadata (ECC seo skill): one honest 120–160 character description per URL,
 * a self-referencing canonical, and noindex for account / checkout surfaces.
 */
export function pageMeta(title: string | undefined, description: string, path: string, opts: { noindex?: boolean } = {}): Metadata {
  return {
    ...(title ? { title } : {}),
    description,
    alternates: { canonical: path },
    openGraph: { ...(title ? { title: `${title} | Deadly Drops Pickleball` } : {}), description, url: path },
    ...(opts.noindex ? { robots: { index: false, follow: true } } : {}),
  }
}
