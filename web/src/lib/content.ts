import 'server-only'
import { draftMode } from 'next/headers'
import { cache } from 'react'
import type { SiteContent } from './content-schema'
import { readDraft, readPublished } from './store/file-store'

/**
 * The content for this request: the published copy, or the draft while the
 * owner previews from the MIS (Next.js draft mode). Read once per request.
 */
export const getContent = cache(async (): Promise<SiteContent> => {
  let preview = false
  try {
    preview = (await draftMode()).isEnabled
  } catch {
    // outside a request (build time, sitemap): published content
  }
  return preview ? readDraft() : readPublished()
})

export const isPreview = cache(async () => {
  try { return (await draftMode()).isEnabled } catch { return false }
})
