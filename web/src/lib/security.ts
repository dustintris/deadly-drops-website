import 'server-only'

/**
 * Route Handlers that change data must be called from this site (CSRF guard).
 * Server Actions already get Next.js' own Origin/Host check.
 */
export function isSameOrigin(req: Request): boolean {
  const origin = req.headers.get('origin')
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host')
  if (origin) {
    try {
      return new URL(origin).host === host
    } catch {
      return false
    }
  }
  return req.headers.get('sec-fetch-site') === 'same-origin'
}
