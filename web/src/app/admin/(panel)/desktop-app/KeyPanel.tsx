'use client'

import { useState } from 'react'
import { revokeAppKeyAction, rotateAppKeyAction, type KeyResult } from '@/app/admin/desktop-app-actions'

const when = (iso: string) => new Date(iso).toLocaleString('en-US', { timeZone: 'America/Los_Angeles', dateStyle: 'medium', timeStyle: 'short' })

export function KeyPanel({ server, set, createdAt }: { server: string; set: boolean; createdAt: string | null }) {
  const [key, setKey] = useState<string | null>(null)
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState('')

  const run = async (fn: () => Promise<KeyResult>, confirmText?: string) => {
    if (busy || (confirmText && !window.confirm(confirmText))) return
    setBusy(true)
    setCopied('')
    try {
      const res = await fn()
      setKey(res.key ?? null)
      setNote({ ok: res.ok, text: res.message })
    } catch {
      setNote({ ok: false, text: 'Couldn’t reach the server. Check the connection and try again.' })
    } finally {
      setBusy(false)
    }
  }
  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(`Copied the ${what}.`)
    } catch {
      setCopied(`Couldn’t copy the ${what}: select the text and copy it yourself.`)
    }
  }

  return (
    <section className="adm-card" aria-labelledby="key-h" style={{ display: 'grid', gap: 14 }}>
      <h2 id="key-h">Connection</h2>
      <div className="adm-field">
        <label htmlFor="app-server">Server address</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input id="app-server" className="adm-input" readOnly value={server} onFocus={(e) => e.target.select()} />
          <button type="button" className="adm-btn" onClick={() => void copy(server, 'address')}>Copy</button>
        </div>
      </div>
      <p>
        <strong>Key: </strong>
        {set ? `on, made ${createdAt ? when(createdAt) : 'earlier'}. It can’t be shown again; make a new one if it’s lost.` : 'off. The app can’t download until you make one.'}
      </p>
      {key && (
        <div className="adm-field">
          <label htmlFor="app-key">New key (shown once)</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input id="app-key" className="adm-input adm-mono" readOnly value={key} onFocus={(e) => e.target.select()} />
            <button type="button" className="adm-btn primary" onClick={() => void copy(key, 'key')}>Copy</button>
          </div>
          <p className="hint">Paste it into the desktop app now. Anyone with this key can download every tournament’s teams.</p>
        </div>
      )}
      <div className="adm-actions">
        <button type="button" className="adm-btn primary" aria-disabled={busy}
          onClick={() => void run(rotateAppKeyAction, set ? 'Make a new key? The desktop app will need the new one; the old key stops working.' : undefined)}>
          {set ? 'Replace key' : 'Create key'}
        </button>
        {set && (
          <button type="button" className="adm-btn danger" aria-disabled={busy}
            onClick={() => void run(revokeAppKeyAction, 'Turn off downloads? The desktop app’s key stops working.')}>
            Turn off
          </button>
        )}
      </div>
      <p role="status" className={`adm-note ${note ? (note.ok ? 'good' : 'bad') : ''}`}>
        {copied ? `${copied} ` : ''}{note?.text ?? ''}
      </p>
    </section>
  )
}
