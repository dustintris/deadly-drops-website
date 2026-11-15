'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { deleteMedia, updateMediaAlt } from '@/app/admin/actions'
import { Uploader } from '@/components/admin/kit'

export type UploadedPhoto = {
  id: string; src: string; alt: string; width: number; height: number; bytes: number; uploadedAt: string; usedBy: string[]
}
export type BundledPhoto = { src: string; name: string; kind: string; stand: boolean; usedBy: string[] }

const size = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`)
const day = (iso: string) => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const grid: React.CSSProperties = { listStyle: 'none', padding: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }
const pic: React.CSSProperties = { width: '100%', aspectRatio: '4 / 3', objectFit: 'cover', borderRadius: 8, background: 'rgb(var(--ink-dark-rgb) / .08)', display: 'block' }

export function MediaManager({ uploads, bundled }: { uploads: UploadedPhoto[]; bundled: BundledPhoto[] }) {
  return (
    <>
      <section aria-labelledby="up-h" className="stack" style={{ display: 'grid', gap: 12 }}>
        <h2 id="up-h">Add photos</h2>
        <Uploader />
      </section>

      <section aria-labelledby="mine-h" style={{ display: 'grid', gap: 12 }}>
        <h2 id="mine-h">Your photos ({uploads.length})</h2>
        {uploads.length === 0 ? (
          <p className="adm-muted">No photos uploaded yet. Drag some into the box above.</p>
        ) : (
          <ul style={grid}>
            {uploads.map((m) => <UploadCard key={m.id} m={m} />)}
          </ul>
        )}
      </section>

      <section aria-labelledby="bundled-h" style={{ display: 'grid', gap: 12 }}>
        <h2 id="bundled-h">Photos that came with the site</h2>
        <p className="adm-muted">These can be picked like your own photos but can't be changed or deleted here. Stock stand-ins are placeholders: swap them for real club photos before the site goes live.</p>
        <ul style={grid}>
          {bundled.map((b) => (
            <li key={b.src} className="adm-card" style={{ padding: 12, display: 'grid', gap: 8 }}>
              <img src={b.src} alt="" loading="lazy" style={{ ...pic, objectFit: b.src === '/logo.png' ? 'contain' : 'cover' }} />
              <strong style={{ textTransform: 'capitalize' }}>{b.name}</strong>
              <span>
                <span className={`adm-badge ${b.stand ? '' : 'on'}`} style={b.stand ? { background: '#ffe0b2', color: '#6b3600' } : undefined}>{b.kind}</span>
              </span>
              <UsedBy list={b.usedBy} />
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}

function UsedBy({ list }: { list: string[] }) {
  if (!list.length) return <p className="adm-muted">Not used anywhere yet.</p>
  return (
    <div className="adm-muted">
      <span style={{ fontWeight: 600 }}>Used by:</span>
      <ul style={{ margin: '2px 0 0 18px' }}>{list.map((u) => <li key={u}>{u}</li>)}</ul>
    </div>
  )
}

function UploadCard({ m }: { m: UploadedPhoto }) {
  const router = useRouter()
  const [alt, setAlt] = useState(m.alt)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const id = `alt-${m.id}`

  const saveAlt = async () => {
    setBusy(true)
    const res = await updateMediaAlt(m.id, alt)
    setBusy(false)
    setMsg({ ok: res.ok, text: res.message })
    if (res.ok) router.refresh()
  }
  const remove = async () => {
    if (!window.confirm('Delete this photo? This cannot be undone.')) return
    setBusy(true)
    const res = await deleteMedia(m.id)
    setBusy(false)
    setMsg({ ok: res.ok, text: res.message })
    if (res.ok) router.refresh()
  }

  return (
    <li className="adm-card" style={{ padding: 12, display: 'grid', gap: 10, alignContent: 'start' }}>
      <img src={m.src} alt="" loading="lazy" style={pic} />
      <p className="adm-muted">{m.width} × {m.height} px · {size(m.bytes)}{day(m.uploadedAt) ? ` · ${day(m.uploadedAt)}` : ''}</p>
      <div className="adm-field">
        <label htmlFor={id}>Description</label>
        <input id={id} className="adm-input" value={alt} maxLength={160} placeholder="e.g. Players high-fiving after the final"
          aria-describedby={`${id}-h`} onChange={(e) => { setAlt(e.target.value); setMsg(null) }} />
        <p className="hint" id={`${id}-h`}>{alt.trim() ? 'Read aloud to people who can\'t see the photo.' : 'Missing: describe what the photo shows.'}</p>
      </div>
      <UsedBy list={m.usedBy} />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className="adm-btn primary" onClick={saveAlt} disabled={busy || alt === m.alt}>Save description</button>
        <button type="button" className="adm-btn danger" onClick={remove} disabled={busy}
          aria-label={`Delete photo${m.alt ? `: ${m.alt}` : ''}`}
          title={m.usedBy.length ? 'Replace it where it is used before deleting' : undefined}>Delete</button>
      </div>
      <p role="status" style={{ fontSize: 13, fontWeight: 600, color: msg ? (msg.ok ? '#2e7d32' : 'var(--danger-on-light)') : undefined }}>{msg?.text ?? ''}</p>
    </li>
  )
}
