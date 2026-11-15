'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { discardChanges, publishDraft } from '@/app/admin/actions'

/** Always-visible draft status with Preview, Publish and Discard. */
export function PublishBar({ changed }: { changed: string[] }) {
  const router = useRouter()
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const n = changed.length

  const run = async (fn: () => Promise<{ message: string }>) => {
    setBusy(true)
    const r = await fn()
    setBusy(false)
    setMsg(r.message)
    router.refresh()
  }

  return (
    <div className="adm-top">
      <p className="state" role="status" aria-live="polite">
        <span className={`adm-dot ${n ? 'warn' : ''}`} aria-hidden="true" />
        {msg || (n ? `Unpublished changes: ${changed.join(', ')}` : 'Everything is published.')}
      </p>
      <a className="adm-btn small" href="/admin/preview/?on=1&amp;path=/" target="_blank" rel="noopener">Preview site</a>
      <button className="adm-btn small" disabled={!n || busy}
        onClick={() => window.confirm('Throw away all unpublished changes?') && run(discardChanges)}>Discard</button>
      <button className="adm-btn small accent" disabled={!n || busy}
        onClick={() => window.confirm(`Publish changes to ${changed.join(', ')}? The live site updates straight away.`) && run(publishDraft)}>
        {busy ? 'Working…' : 'Publish'}
      </button>
    </div>
  )
}
