import 'server-only'
import type { SiteContent } from './content-schema'

/**
 * Where an image is used, so the owner never deletes a picture the site still shows.
 * Plain server function (not a Server Action): callers must already have checked the session.
 */
export function findUsage(src: string, d: SiteContent): string[] {
  const where: string[] = []
  const has = (v: unknown) => JSON.stringify(v).includes(`"${src}"`)
  d.products.forEach((p) => has(p) && where.push(`Product: ${p.name}`))
  d.gallery.forEach((g) => has(g) && where.push(`Gallery: ${g.caption}`))
  d.posts.forEach((p) => has(p) && where.push(`Community: ${p.title}`))
  // a charity's logo or flyer
  d.charities.forEach((c) => has(c) && where.push(`Charity: ${c.name}`))
  Object.entries(d.pages).forEach(([k, p]) => has(p) && where.push(`Page: ${k}`))
  // the theme is colours plus the club logo: only the logo can match an image path
  if (has(d.theme)) where.push('Logo & colours: club logo')
  return where
}
