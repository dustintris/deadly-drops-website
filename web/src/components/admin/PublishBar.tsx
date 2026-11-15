'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { asset } from '@/lib/utils'
import { discardChanges, publishDraft } from '@/app/admin/actions'

/** Always-visible draft status with Preview, Publish and Discard. */
export function PublishBar({ changed }: { changed: string[] }) {
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
        <span className={`adm-dot ${n ? 'warn' : ''}`} aria-hidden="true" />
        {msg || (n ? `Unpublished changes: ${changed.join(', ')}` : 'Everything is published.')}
      </p>
      <a className="adm-btn small" href={asset('/admin/preview/?on=1&path=/')} target="_blank" rel="noopener">Preview site</a>
      <button className="adm-btn small" disabled={!n || busy}
        onClick={() => window.confirm('Throw away all unpublished changes?') && run(discardChanges)}>Discard</button>
      <button className="adm-btn small accent" disabled={!n || busy}
        onClick={() => window.confirm(`Publish changes to ${changed.join(', ')}? The live site updates straight away.`) && run(publishDraft)}>
        {busy ? 'Working…' : 'Publish'}
      </button>
    </div>
  )
}
