/**
 * Tournament registration runs on Main Court (maincourt.com and its app): players sign up there, pick a
 * division, pay and see their entry under "My Tournaments". This site only sends them there: each
 * tournament's "Main Court link" (Admin → Tournaments) is its event page on Main Court.
 */

/** Main Court's own site, where its free app is offered for iPhone and Android. */
export const MAINCOURT_HOME = 'https://maincourt.com/'
/** "Main Court: Pickleball Matches" on the App Store. */
export const MAINCOURT_APP_STORE = 'https://apps.apple.com/us/app/-/id6471336853'
/** The Main Court app on Google Play (package com.maincourt). */
export const MAINCOURT_GOOGLE_PLAY = 'https://play.google.com/store/apps/details?id=com.maincourt'

/** An https link on maincourt.com (or one of its subdomains), without a name or password before the host. */
export function isMainCourtUrl(url: string): boolean {
  try {
    const u = new URL(url)
    const host = u.hostname.toLowerCase()
    return u.protocol === 'https:' && !u.username && !u.password && (host === 'maincourt.com' || host.endsWith('.maincourt.com'))
  } catch {
    return false
  }
}
