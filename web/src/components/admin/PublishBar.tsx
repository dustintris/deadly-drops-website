'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { asset } from '@/lib/utils'
import { discardChanges, publishDraft } from '@/app/admin/actions'

/**
 * Always-visible draft status with Preview, Publish and Discard. Publish and Discard act only on
 * `changed` (sections this person may edit); `others` are waiting on someone with access.
 */
export function PublishBar({ changed, others }: { changed: string[]; others: string[] }) {
  const router = useRouter()
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const n = changed.length
  // a new list of unpublished areas replaces any old "Published" message
  const key = changed.join('|')
  const [lastKey, setLastKey] = useState(key)
  if (key !== lastKey) { setLastKey(key); setMsg('') }

  const run = async (fn: () => Promise<{ message: string }>) => {
    setBusy(true)
    try {
      const r = await fn()
      setMsg(r.message)
    } catch {
      setMsg('Could not reach the server. Check your connection, or sign in again, then retry.')
    } finally {
      setBusy(false)
    }
    router.refresh()
  }

  return (
    <div className="adm-top">
      <p className="state" role="status" aria-live="polite">
        <span className={`adm-dot ${n || others.length ? 'warn' : ''}`} aria-hidden="true" />
        {msg || (n ? `Unpublished changes: ${changed.join(', ')}` : others.length ? 'Nothing of yours to publish.' : 'Everything is published.')}
      </p>
      <a className="adm-btn small" href={asset('/admin/preview/?on=1&path=/')} target="_blank" rel="noopener">Preview site</a>
      <button className="adm-btn small" disabled={!n || busy}
        onClick={() => window.confirm(`Throw away unpublished changes to ${changed.join(', ')}?`) && run(discardChanges)}>Discard</button>
      <button className="adm-btn small accent" disabled={!n || busy}
        onClick={() => window.confirm(`Publish changes to ${changed.join(', ')}? The live site updates straight away.`) && run(publishDraft)}>
        {busy ? 'Working…' : 'Publish'}
      </button>
      {others.length > 0 && (
        // own row under the buttons
        <p className="adm-muted" style={{ flexBasis: '100%', order: 1 }}>
          Also waiting: {others.join(', ')} (someone with access needs to publish)
        </p>
      )}
    </div>
  )
}
