import 'server-only'

/**
 * This website's address for the desktop app: NEXT_PUBLIC_SITE_URL plus the base path (always set in production).
 * Outside production the request's own Host header stands in when it isn't set.
 */
export function siteAddress(requestHost: string | null): string {
  const host = process.env.NODE_ENV === 'production' ? '' : (requestHost ?? '')
  const origin = process.env.NEXT_PUBLIC_SITE_URL || (host ? `http://${host}` : '')
  return origin ? origin + (process.env.NEXT_PUBLIC_BASE_PATH || '') : ''
}
