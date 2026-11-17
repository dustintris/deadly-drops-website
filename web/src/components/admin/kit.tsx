'use client'

/**
 * MIS form kit. Each admin screen edits one content "section" with useSection(), renders fields
 * with these components (they show the server's validation errors by path), and saves with <SaveBar>.
 */
import { useRouter } from 'next/navigation'
import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from 'react'
import { saveSection, type ActionResult } from '@/app/admin/actions'
import { parseMoney, sectionHash, type SectionKey } from '@/lib/content-schema'
import { asset } from '@/lib/utils'

/* ---------- section state ---------- */

type Errors = Record<string, string>
const ErrorCtx = createContext<Errors>({})
export const useFieldError = (path: string) => useContext(ErrorCtx)[path]

/* ---------- read-only gate ---------- */

// default true: an editor that isn't wrapped in <EditGate> stays editable
const EditCtx = createContext(true)

/**
 * Wraps an editor. Without edit rights the fields are still shown but locked (a disabled fieldset
 * disables every control inside), SaveBar disappears and saving does nothing. The server still
 * rejects the save: this only keeps the screen honest.
 */
export function EditGate({ canEdit, children }: { canEdit: boolean; children: React.ReactNode }) {
  const noteId = useId()
  // always the same wrapper, only `disabled` changes: an editor keeps its state if the person's access changes
  return (
    <EditCtx.Provider value={canEdit}>
      {!canEdit && <p id={noteId} className="adm-card" role="note" style={{ fontWeight: 600 }}>You can view this but not change it.</p>}
      <fieldset disabled={!canEdit} className={canEdit ? undefined : 'adm-readonly'} aria-describedby={canEdit ? undefined : noteId}
        style={{ border: 0, padding: 0, margin: 0, minWidth: 0, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 20 }}>
        {children}
      </fieldset>
    </EditCtx.Provider>
  )
}

export function useSection<T>(section: SectionKey, initial: T, _rev?: number) {
  const canEdit = useContext(EditCtx)
  const router = useRouter()
  const [value, setValueRaw] = useState<T>(initial)
  const [base, setBase] = useState(() => sectionHash(initial))
  const [saved, setSaved] = useState(() => JSON.stringify(initial))
  const [errors, setErrors] = useState<Errors>({})
  const [result, setResult] = useState<ActionResult | null>(null)
  const [busy, setBusy] = useState(false)
  const dirty = JSON.stringify(value) !== saved

  // editing clears old messages (server errors are keyed by position and go stale after a reorder)
  const setValue = useCallback((v: T | ((p: T) => T)) => { setValueRaw(v); setErrors({}); setResult(null) }, [])

  // the server sent new content (Discard, Publish, a save elsewhere): take it unless the owner is mid-edit
  const incoming = JSON.stringify(initial)
  const [lastIncoming, setLastIncoming] = useState(incoming)
  if (incoming !== lastIncoming) {
    setLastIncoming(incoming)
    if (!dirty) { setValueRaw(initial); setSaved(incoming); setBase(sectionHash(initial)) }
  }

  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', warn)
    document.body.dataset.unsaved = '1' // AdminNav asks before leaving
    return () => { window.removeEventListener('beforeunload', warn); delete document.body.dataset.unsaved }
  }, [dirty])

  const save = useCallback(async () => {
    if (!canEdit) return
    setBusy(true)
    setResult(null)
    let res: ActionResult
    try {
      res = await saveSection(section, JSON.stringify(value), base)
    } catch {
      res = { ok: false, message: 'Could not reach the server. Check your connection, or sign in again, then save.' }
    } finally {
      setBusy(false)
    }
    setResult(res)
    setErrors(res.errors ?? {})
    if (res.ok && res.hash) {
      setBase(res.hash)
      setSaved(JSON.stringify(value))
      setLastIncoming(JSON.stringify(value))
      router.refresh()
    } else if (res.errors) {
      const first = Object.keys(res.errors)[0]
      requestAnimationFrame(() => {
        const el = document.getElementById(`f-${first}`) ?? document.querySelector<HTMLElement>(`[data-path^="${first}"]`)
        if (el) { el.closest('details')?.setAttribute('open', ''); el.focus(); el.scrollIntoView({ block: 'center' }) }
      })
    }
  }, [canEdit, section, value, base, router])

  /** set a nested value by path segments: update(['0','name'], 'x') */
  const update = useCallback((path: (string | number)[], v: unknown) => {
    setValue((prev) => setIn(prev, path, v))
  }, [])

  return { value, setValue, update, save, dirty, busy, result, errors }
}

function setIn<T>(obj: T, path: (string | number)[], v: unknown): T {
  if (!path.length) return v as T
  const [k, ...rest] = path
  const copy: any = Array.isArray(obj) ? [...(obj as unknown[])] : { ...(obj as object) }
  copy[k] = setIn(copy[k], rest, v)
  return copy
}

export function SectionForm({ errors, children }: { errors: Errors; children: React.ReactNode }) {
  return <ErrorCtx.Provider value={errors}>{children}</ErrorCtx.Provider>
}

export function SaveBar({ s, label = 'Save draft' }: { s: { save: () => void; dirty: boolean; busy: boolean; result: ActionResult | null }; label?: string }) {
  const canEdit = useContext(EditCtx)
  if (!canEdit) return null
  return (
    <div className="adm-save" role="region" aria-label="Save">
      <p className={`msg ${s.result ? (s.result.ok ? 'good' : 'bad') : ''}`} role="status">
        {s.busy ? 'Saving…' : s.result ? s.result.message : s.dirty ? 'You have unsaved changes.' : 'No unsaved changes.'}
      </p>
      <button type="button" className="adm-btn primary" onClick={s.save} disabled={s.busy || !s.dirty}>{label}</button>
    </div>
  )
}

/* ---------- fields ---------- */

type Base = { label: string; path: string; hint?: string }

export function TextField({ label, path, hint, value, onChange, max, type = 'text', placeholder, multiline }: Base & {
  value: string | undefined; onChange: (v: string) => void; max?: number; type?: string; placeholder?: string; multiline?: boolean | number
}) {
  const err = useFieldError(path)
  const id = `f-${path}`
  const common = {
    id, className: 'adm-input', value: value ?? '', placeholder, maxLength: max,
    'aria-invalid': !!err, 'aria-describedby': `${id}-h`,
    onChange: (e: React.ChangeEvent<HTMLInputElement & HTMLTextAreaElement>) => onChange(e.target.value),
  }
  return (
    <div className="adm-field">
      <label htmlFor={id}>{label}</label>
      {multiline ? <textarea {...common} rows={typeof multiline === 'number' ? multiline : 4} /> : <input {...common} type={type} />}
      <div id={`${id}-h`}>
        {err ? <p className="err">{err}</p> : hint ? <p className="hint">{hint}</p> : null}
        {max && (value?.length ?? 0) > max * 0.8 ? <p className="adm-count">{value?.length ?? 0} / {max}</p> : null}
      </div>
    </div>
  )
}

/** Price box: the owner types "55" or "$55.00"; stored as a number. */
export function MoneyField({ label, path, hint, value, onChange, optional }: Base & { value: number | undefined; onChange: (v: number | undefined) => void; optional?: boolean }) {
  const err = useFieldError(path)
  const show = (v: number | undefined) => (v === undefined ? '' : v.toFixed(2).replace(/\.00$/, ''))
  const [text, setText] = useState(show(value))
  const [local, setLocal] = useState<string | null>(null)
  // value changed from outside (another row moved here, Discard, reset): show it
  const [lastValue, setLastValue] = useState(value)
  if (value !== lastValue) {
    setLastValue(value)
    if (value !== (text.trim() === '' ? undefined : parseMoney(text))) { setText(show(value)); setLocal(null) }
  }
  const id = `f-${path}`
  return (
    <div className="adm-field">
      <label htmlFor={id}>{label}</label>
      <div className="adm-money">
        <span aria-hidden="true">$</span>
        <input
          id={id} className="adm-input" inputMode="decimal" value={text} aria-invalid={!!(err || local)} aria-describedby={`${id}-h`}
          onChange={(e) => {
            setText(e.target.value)
            if (optional && e.target.value.trim() === '') { setLocal(null); onChange(undefined); return }
            const n = parseMoney(e.target.value)
            setLocal(n === null ? 'Enter an amount like 55 or 55.50.' : null)
            if (n !== null) onChange(n)
          }}
        />
      </div>
      <div id={`${id}-h`}>{local || err ? <p className="err">{local || err}</p> : hint ? <p className="hint">{hint}</p> : null}</div>
    </div>
  )
}

export function NumberField({ label, path, hint, value, onChange, min, max, step = 1, allowEmpty }: Base & {
  value: number | null | undefined; onChange: (v: number | null) => void; min?: number; max?: number; step?: number; allowEmpty?: boolean
}) {
  const err = useFieldError(path)
  const id = `f-${path}`
  return (
    <div className="adm-field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id} className="adm-input" type="number" inputMode="numeric" min={min} max={max} step={step} value={value ?? ''} aria-invalid={!!err}
        onChange={(e) => onChange(e.target.value === '' ? (allowEmpty ? null : 0) : Number(e.target.value))}
      />
      {err ? <p className="err">{err}</p> : hint ? <p className="hint">{hint}</p> : null}
    </div>
  )
}

export function Check({ label, path, checked, onChange, hint }: Base & { checked: boolean; onChange: (v: boolean) => void }) {
  const err = useFieldError(path)
  return (
    <div className="adm-field">
      <label className="adm-check"><input id={`f-${path}`} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /> {label}</label>
      {err ? <p className="err">{err}</p> : hint ? <p className="hint">{hint}</p> : null}
    </div>
  )
}

export function Select<T extends string>({ label, path, value, options, onChange, hint }: Base & { value: T | undefined; options: { value: T | ''; label: string }[]; onChange: (v: T | undefined) => void }) {
  const err = useFieldError(path)
  const id = `f-${path}`
  return (
    <div className="adm-field">
      <label htmlFor={id}>{label}</label>
      <select id={id} className="adm-input" value={value ?? ''} aria-invalid={!!err} onChange={(e) => onChange((e.target.value || undefined) as T | undefined)}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {err ? <p className="err">{err}</p> : hint ? <p className="hint">{hint}</p> : null}
    </div>
  )
}

/** A list of short strings, one per line. */
export function LinesField({ label, path, value, onChange, hint, max }: Base & { value: string[]; onChange: (v: string[]) => void; max?: number }) {
  const all = useContext(ErrorCtx)
  const err = all[path] ?? Object.entries(all).find(([k]) => k.startsWith(path + '.'))?.[1]
  const id = `f-${path}`
  return (
    <div className="adm-field">
      <label htmlFor={id}>{label}</label>
      <textarea id={id} className="adm-input" rows={Math.max(3, value.length + 1)} value={value.join('\n')} aria-invalid={!!err}
        onChange={(e) => onChange(e.target.value.split('\n').slice(0, max ?? 50))} />
      {err ? <p className="err">{err}</p> : <p className="hint">{hint ?? 'One per line.'}</p>}
    </div>
  )
}

/* ---------- list editor ---------- */

export function ListEditor<T>({ items, onChange, render, title, thumb, badge, makeNew, addLabel = 'Add', path, startOpen, getKey }: {
  items: T[]; onChange: (items: T[]) => void; render: (item: T, i: number, set: (v: T) => void) => React.ReactNode
  title: (item: T) => string; thumb?: (item: T) => string | undefined; badge?: (item: T) => React.ReactNode
  makeNew?: () => T; addLabel?: string; path: string; startOpen?: boolean
  /** stable key per item (defaults to item.id) so moving or deleting rows never mixes up their fields */
  getKey?: (item: T, i: number) => string
}) {
  const keyOf = getKey ?? ((item: T, i: number) => String((item as { id?: string }).id ?? i))
  const errors = useContext(ErrorCtx)
  const move = (i: number, d: number) => {
    const j = i + d
    if (j < 0 || j >= items.length) return
    const next = [...items]
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }
  return (
    <div className="stack">
      {(path ? errors[path] : errors._) && <p className="err" role="alert" style={{ color: 'var(--danger-on-light)', fontWeight: 600 }}>{path ? errors[path] : errors._}</p>}
      <ul className="adm-list">
        {items.map((item, i) => {
          const hasErr = Object.keys(errors).some((k) => k.startsWith(`${path ? path + '.' : ''}${i}.`))
          const src = thumb?.(item)
          return (
            <li key={keyOf(item, i)}>
              <details className="adm-item" open={startOpen || hasErr || undefined} data-path={`${path ? path + '.' : ''}${i}`} aria-label={title(item) || 'Untitled'}>
                <summary style={{ listStyle: 'none' }}>
                  <header>
                    <span className="title">
                      {src && <img src={src} alt="" />}
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{title(item) || 'Untitled'}</span>
                      {badge?.(item)}
                      {hasErr && <span className="adm-badge" style={{ background: 'var(--danger-on-light)', color: '#fff' }}>Needs a fix</span>}
                    </span>
                    <button type="button" className="adm-btn icon small" onClick={(e) => { e.preventDefault(); move(i, -1) }} disabled={i === 0} aria-label={`Move ${title(item)} up`}>↑</button>
                    <button type="button" className="adm-btn icon small" onClick={(e) => { e.preventDefault(); move(i, 1) }} disabled={i === items.length - 1} aria-label={`Move ${title(item)} down`}>↓</button>
                    <button type="button" className="adm-btn icon small danger" aria-label={`Remove ${title(item)}`}
                      onClick={(e) => { e.preventDefault(); if (window.confirm(`Remove "${title(item) || 'this item'}"? You can still discard the draft before publishing.`)) onChange(items.filter((_, k) => k !== i)) }}>✕</button>
                  </header>
                </summary>
                <div className="body">{render(item, i, (v) => onChange(items.map((x, k) => (k === i ? v : x))))}</div>
              </details>
            </li>
          )
        })}
      </ul>
      {makeNew && (
        <button type="button" className="adm-btn" style={{ marginTop: 12 }} onClick={() => onChange([...items, makeNew()])}>+ {addLabel}</button>
      )}
    </div>
  )
}

/* ---------- images ---------- */

export type LibraryImage = { src: string; alt: string; label: string; stand?: boolean }
const LibraryCtx = createContext<{ images: LibraryImage[]; add: (img: LibraryImage) => void }>({ images: [], add: () => {} })

export function MediaLibraryProvider({ initial, children }: { initial: LibraryImage[]; children: React.ReactNode }) {
  const [images, setImages] = useState(initial)
  const value = useMemo(() => ({ images, add: (img: LibraryImage) => setImages((l) => [img, ...l.filter((x) => x.src !== img.src)]) }), [images])
  return <LibraryCtx.Provider value={value}>{children}</LibraryCtx.Provider>
}
export const useLibrary = () => useContext(LibraryCtx)

type ImageRef = { src: string; alt: string; position?: string }

export function ImageField({ label, path, value, onChange, hint, required }: Base & { value: ImageRef | undefined; onChange: (v: ImageRef | undefined) => void; required?: boolean }) {
  const all = useContext(ErrorCtx)
  const err = all[path] ?? all[`${path}.src`] ?? all[`${path}.alt`] ?? all[`${path}.position`]
  const [open, setOpen] = useState(false)
  const id = `f-${path}`
  return (
    <div className="adm-field">
      <span className="lbl">{label}</span>
      <div className="adm-imagefield">
        <div className="preview">{value?.src ? <img src={asset(value.src)} alt="" style={{ objectPosition: value.position }} /> : 'No image'}</div>
        <div style={{ display: 'grid', gap: 8, flex: 1, minWidth: 200 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button id={id} type="button" className="adm-btn" aria-label={`${label}: ${value?.src ? 'change' : 'choose'} image`} onClick={() => setOpen(true)}>{value?.src ? 'Change image' : 'Choose image'}</button>
            {value?.src && !required && <button type="button" className="adm-btn danger" onClick={() => onChange(undefined)}>Remove</button>}
          </div>
          {value?.src && (
            <input className="adm-input" aria-label={`${label}: description for screen readers`} placeholder="Describe the photo (for screen readers)" maxLength={160}
              value={value.alt} onChange={(e) => onChange({ ...value, alt: e.target.value })} />
          )}
          {value?.src && (
            <input className="adm-input" aria-label={`${label}: focal point`} placeholder="Focal point, e.g. 50% 30%" value={value.position ?? ''}
              onChange={(e) => onChange({ ...value, position: e.target.value || undefined })} />
          )}
        </div>
      </div>
      {err ? <p className="err">{err}</p> : hint ? <p className="hint">{hint}</p> : null}
      {open && <ImagePicker current={value?.src} onClose={() => setOpen(false)} onPick={(img) => { onChange({ src: img.src, alt: img.alt, position: value?.position }); setOpen(false) }} />}
    </div>
  )
}

export function ImagePicker({ current, onPick, onClose }: { current?: string; onPick: (img: LibraryImage) => void; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const { images } = useLibrary()
  useEffect(() => { ref.current?.showModal() }, [])
  return (
    <dialog ref={ref} className="adm-dialog" onClose={onClose} aria-label="Choose an image">
      <div>
        <div className="adm-head"><h2>Choose an image</h2><button className="adm-btn" onClick={() => ref.current?.close()}>Close</button></div>
        <Uploader onUploaded={onPick} compact />
        <ul className="adm-thumbs" style={{ listStyle: 'none', padding: 0, maxHeight: '55svh', overflowY: 'auto' }}>
          {images.map((img) => (
            <li key={img.src} className="adm-thumb" aria-pressed={img.src === current}>
              <img src={asset(img.src)} alt="" loading="lazy" />
              <span className="cap">{img.stand ? 'Stand-in · ' : ''}{img.label}</span>
              <button className="pick" onClick={() => onPick(img)} aria-label={`Use ${img.label}`} />
            </li>
          ))}
        </ul>
      </div>
    </dialog>
  )
}

/** Shrinks big phone photos in the browser (max 2400 px, re-encoded, which also drops GPS data) and uploads them. */
async function prepare(file: File): Promise<Blob> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return file
  try {
    const bmp = await createImageBitmap(file)
    const scale = Math.min(1, 2400 / Math.max(bmp.width, bmp.height))
    if (scale === 1 && file.size < 1.5 * 1024 * 1024 && file.type !== 'image/jpeg') return file
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bmp.width * scale)
    canvas.height = Math.round(bmp.height * scale)
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height)
    const type = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
    return await new Promise<Blob>((res) => canvas.toBlob((b) => res(b ?? file), type, 0.85))
  } catch {
    return file
  }
}

export function Uploader({ onUploaded, compact }: { onUploaded?: (img: LibraryImage) => void; compact?: boolean }) {
  const { add } = useLibrary()
  const canEdit = useContext(EditCtx)
  const router = useRouter()
  const [over, setOver] = useState(false)
  const [msg, setMsg] = useState('')
  const input = useRef<HTMLInputElement>(null)

  const upload = async (files: FileList | null) => {
    // a disabled fieldset locks the buttons but not drag-and-drop onto the drop zone
    if (!canEdit || !files?.length) return
    for (const f of Array.from(files)) {
      setMsg(`Uploading ${f.name}…`)
      const body = new FormData()
      body.append('file', await prepare(f), f.name.replace(/\.[^.]+$/, '') + '.img')
      body.append('alt', '')
      const res = await fetch(asset('/admin/api/upload/'), { method: 'POST', body }).catch(() => null)
      if (!res) { setMsg(`${f.name}: could not reach the server. Check your connection.`); return }
      const data = await res.json().catch(() => ({ ok: false, message: 'Upload failed.' }))
      if (!data.ok) { setMsg(`${f.name}: ${data.message}`); return }
      const img = { src: data.src as string, alt: '', label: f.name }
      add(img)
      onUploaded?.(img)
    }
    setMsg('Uploaded. Add a short description so screen readers can describe it.')
    router.refresh()
  }

  return (
    <div className="adm-drop" data-over={over}
      onDragOver={(e) => { e.preventDefault(); setOver(true) }} onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); upload(e.dataTransfer.files) }}>
      <p style={{ fontWeight: 600 }}>{compact ? 'Upload a new photo' : 'Drag photos here, or'}</p>
      <button type="button" className="adm-btn" style={{ marginTop: 8 }} onClick={() => input.current?.click()}>Choose photos</button>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => upload(e.target.files)} />
      <p className="adm-muted" style={{ marginTop: 8 }} role="status">{msg || 'JPEG, PNG or WebP, up to 5 MB. Big photos are shrunk automatically.'}</p>
    </div>
  )
}

/* ---------- misc ---------- */

export const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
export const slugify = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60)
/** A web address field as they type: lowercase, anything else becomes one dash; a dash at the end stays so "us4-" can be typed. */
export const cleanSlug = (v: string) =>
  v.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+/, '').slice(0, 60)
