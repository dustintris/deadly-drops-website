import 'server-only'
import { draftMode } from 'next/headers'
import { cache } from 'react'
import type { SiteContent } from './content-schema'
import { getSession } from './auth/session'
import { readDraft, readPublished } from './store/file-store'

/** Draft preview needs both Next's draft-mode cookie and a live admin session (so it ends with the session). */
export const isPreview = cache(async () => {
  try {
    if (!(await draftMode()).isEnabled) return false
  } catch {
    return false // outside a request (build time, sitemap): published content
  }
  return !!(await getSession())
})

/**
 * The content for this request: the published copy, or the draft while the
 * owner previews from the MIS (Next.js draft mode). Read once per request.
 */
export const getContent = cache(async (): Promise<SiteContent> => {
  return (await isPreview()) ? readDraft() : readPublished()
})

