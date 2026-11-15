'use client'

import { useState } from 'react'
import {
  Check, ImagePicker, ListEditor, MoneyField, newId, NumberField, SaveBar, SectionForm, Select, slugify, TextField, useFieldError, useSection,
} from '@/components/admin/kit'
import type { ProductT } from '@/lib/content-schema'
import { money } from '@/lib/utils'

type Img = ProductT['images'][number]
type Opt = NonNullable<ProductT['options']>[number]

const CATEGORIES: { value: ProductT['category']; label: string }[] = [
  { value: 'Paddles', label: 'Paddles' },
  { value: 'Apparel', label: 'Apparel' },
  { value: 'Gear', label: 'Gear' },
  { value: 'Balls', label: 'Balls' },
]
const TAGS: { value: NonNullable<ProductT['tag']> | ''; label: string }[] = [
  { value: '', label: 'No label' },
  { value: 'NEW', label: 'NEW' },
  { value: 'MEMBER', label: 'MEMBER (best seller)' },
  { value: 'LOW', label: 'LOW (running low)' },
]
const MAX_IMAGES = 6
const MAX_OPTIONS = 3

const fieldset = { border: '1px solid rgb(var(--ink-dark-rgb) / .1)' }
const legend = { fontWeight: 700, padding: '0 6px' }

export function ProductsEditor({ initial, rev }: { initial: ProductT[]; rev: number }) {
  const s = useSection('products', initial, rev)
  const list = s.value

  return (
    <SectionForm errors={s.errors}>
      <ListEditor<ProductT>
        path=""
        items={list}
        onChange={s.setValue}
        title={(p) => p.name}
        thumb={(p) => p.images?.[0]?.src || undefined}
        startOpen={list.length === 1}
        badge={(p) => (
          <>
            <span className="adm-badge">{money(p.price)}</span>
            {p.stock === 0 && <span className="adm-badge" style={{ background: 'var(--ink-dark)', color: 'var(--ink)' }}>Sold out</span>}
            {!p.visible && <span className="adm-badge off">Hidden</span>}
          </>
        )}
        addLabel="Add product"
        makeNew={() => ({
          id: newId(), slug: `product-${list.length + 1}`, name: 'New product', sub: '', price: 10, category: 'Gear',
          description: undefined, options: [], images: [], stock: null, visible: false,
        })}
        render={(p, i, set) => {
          const path = (k: string) => `${i}.${k}`
          return (
            <>
              <div className="adm-grid">
                <TextField label="Product name" path={path('name')} value={p.name} max={60}
                  onChange={(v) => set({ ...p, name: v, slug: p.slug.startsWith('product-') || p.slug === slugify(p.name) ? slugify(v) : p.slug })} />
                <TextField label="Web address" path={path('slug')} value={p.slug} hint="Lowercase words with dashes. The page will be /shop/your-words/."
                  onChange={(v) => set({ ...p, slug: slugify(v) })} />
              </div>
              <TextField label="Short description" path={path('sub')} value={p.sub} max={60} placeholder="e.g. Carbon face, 16 mm core"
                hint="One line shown under the name in the shop." onChange={(v) => set({ ...p, sub: v })} />
              <div className="adm-grid">
                <Select label="Category" path={path('category')} value={p.category} options={CATEGORIES}
                  onChange={(v) => set({ ...p, category: v ?? 'Gear' })} />
                <Select label="Label on the photo" path={path('tag')} value={p.tag} options={TAGS}
                  onChange={(v) => set({ ...p, tag: v })} />
              </div>
              <div className="adm-grid">
                <MoneyField label="Price" path={path('price')} value={p.price} hint="Members get the member discount off this price."
                  onChange={(v) => set({ ...p, price: v ?? 0 })} />
                <NumberField label="How many in stock" path={path('stock')} value={p.stock} min={0} max={100000} allowEmpty
                  hint="Leave empty if you don't count stock. Enter 0 to show it as sold out. 1 to 5 shows “Only N left”."
                  onChange={(v) => set({ ...p, stock: v === null ? null : Math.max(0, Math.round(v)) })} />
              </div>
              <TextField label="Full description" path={path('description')} value={p.description ?? ''} max={1000} multiline={5}
                hint="Shown on the product's own page." onChange={(v) => set({ ...p, description: v || undefined })} />

              <fieldset className="adm-card" style={fieldset}>
                <legend className="lbl" style={legend}>Photos</legend>
                <ImagesEditor path={path('images')} name={p.name} images={p.images ?? []} onChange={(images) => set({ ...p, images })} />
              </fieldset>

              <fieldset className="adm-card" style={fieldset}>
                <legend className="lbl" style={legend}>Choices (size, colour…)</legend>
                <OptionsEditor path={path('options')} options={p.options ?? []} onChange={(options) => set({ ...p, options })} />
              </fieldset>

              <Check label="Show in the shop" path={path('visible')} checked={p.visible} onChange={(v) => set({ ...p, visible: v })} />
            </>
          )
        }}
      />
      <SaveBar s={s} />
    </SectionForm>
  )
}

/* ---------- photos ---------- */

function ImagesEditor({ path, name, images, onChange }: { path: string; name: string; images: Img[]; onChange: (v: Img[]) => void }) {
  const [picking, setPicking] = useState(false)
  const err = useFieldError(path)
  const move = (j: number, d: number) => {
    const k = j + d
    if (k < 0 || k >= images.length) return
    const next = [...images]
    ;[next[j], next[k]] = [next[k], next[j]]
    onChange(next)
  }
  return (
    <div className="stack" style={{ display: 'grid', gap: 12 }}>
      <p className="adm-muted">Up to {MAX_IMAGES} photos. The first one is the main photo in the shop. Without photos, a drawing is shown instead.</p>
      {err && <p className="err" style={{ color: 'var(--danger-on-light)', fontWeight: 600 }}>{err}</p>}
      {images.length > 0 && (
        <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 12 }}>
          {images.map((img, j) => (
            <ImageRow key={`${img.src}-${j}`} path={`${path}.${j}`} img={img} index={j} count={images.length} name={name}
              onChange={(v) => onChange(images.map((x, k) => (k === j ? v : x)))}
              onMove={(d) => move(j, d)}
              onRemove={() => onChange(images.filter((_, k) => k !== j))} />
          ))}
        </ul>
      )}
      {images.length < MAX_IMAGES ? (
        <div><button type="button" className="adm-btn" onClick={() => setPicking(true)}>+ Add a photo</button></div>
      ) : (
        <p className="adm-muted">That's the maximum of {MAX_IMAGES} photos. Remove one to add another.</p>
      )}
      {picking && (
        <ImagePicker onClose={() => setPicking(false)}
          onPick={(img) => { if (images.length < MAX_IMAGES) onChange([...images, { src: img.src, alt: img.alt || name }]); setPicking(false) }} />
      )}
    </div>
  )
}

function ImageRow({ path, img, index, count, name, onChange, onMove, onRemove }: {
  path: string; img: Img; index: number; count: number; name: string
  onChange: (v: Img) => void; onMove: (d: number) => void; onRemove: () => void
}) {
  const errSelf = useFieldError(path)
  const errSrc = useFieldError(`${path}.src`)
  const errAlt = useFieldError(`${path}.alt`)
  const err = errSelf ?? errSrc ?? errAlt
  const label = index === 0 ? 'Main photo' : `Photo ${index + 1}`
  return (
    <li data-path={path} style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
      <div className="adm-imagefield"><div className="preview"><img src={img.src} alt="" style={{ objectPosition: img.position }} /></div></div>
      <div style={{ flex: 1, minWidth: 200, display: 'grid', gap: 6 }}>
        <label htmlFor={`f-${path}.alt`} style={{ fontWeight: 600, fontSize: 14 }}>{label}: description for screen readers</label>
        <input id={`f-${path}.alt`} className="adm-input" maxLength={160} value={img.alt} placeholder={`e.g. ${name || 'Product'} seen from the front`}
          aria-invalid={!!err} onChange={(e) => onChange({ ...img, alt: e.target.value })} />
        {err && <p className="err" style={{ fontSize: 13, color: 'var(--danger-on-light)', fontWeight: 600 }}>{err}</p>}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="adm-btn" onClick={() => onMove(-1)} disabled={index === 0}
            aria-label={index === 1 ? `Make ${label.toLowerCase()} the main photo` : `Move ${label.toLowerCase()} earlier`}>
            {index === 1 ? 'Make main photo' : '← Earlier'}
          </button>
          <button type="button" className="adm-btn" onClick={() => onMove(1)} disabled={index === count - 1} aria-label={`Move ${label.toLowerCase()} later`}>Later →</button>
          <button type="button" className="adm-btn danger" onClick={onRemove} aria-label={`Remove ${label.toLowerCase()}`}>Remove</button>
        </div>
      </div>
    </li>
  )
}

/* ---------- options ---------- */

const splitValues = (raw: string) => raw.split(/[,\n]/).map((v) => v.trim()).filter(Boolean).slice(0, 12)

function OptionsEditor({ path, options, onChange }: { path: string; options: Opt[]; onChange: (v: Opt[]) => void }) {
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <p className="adm-muted">Let shoppers pick, for example, a size or colour. Up to {MAX_OPTIONS} choices. Leave empty if there is nothing to pick.</p>
      {options.map((o, k) => (
        <div key={k} className="adm-grid" style={{ alignItems: 'start' }}>
          <TextField label={`Choice ${k + 1} name`} path={`${path}.${k}.label`} value={o.label} max={20} placeholder="e.g. Size"
            onChange={(v) => onChange(options.map((x, n) => (n === k ? { ...x, label: v } : x)))} />
          <ValuesField path={`${path}.${k}.values`} label={`Choice ${k + 1} options`} values={o.values}
            onChange={(values) => onChange(options.map((x, n) => (n === k ? { ...x, values } : x)))} />
          <div style={{ alignSelf: 'end', paddingBottom: 24 }}>
            <button type="button" className="adm-btn danger" onClick={() => onChange(options.filter((_, n) => n !== k))}
              aria-label={`Remove choice ${k + 1}${o.label ? ` (${o.label})` : ''}`}>Remove choice</button>
          </div>
        </div>
      ))}
      {options.length < MAX_OPTIONS && (
        <div><button type="button" className="adm-btn" onClick={() => onChange([...options, { label: '', values: [] }])}>+ Add a choice</button></div>
      )}
    </div>
  )
}

function ValuesField({ path, label, values, onChange }: { path: string; label: string; values: string[]; onChange: (v: string[]) => void }) {
  const [raw, setRaw] = useState(values.join(', '))
  // keep the box in step if the list changes from outside (e.g. reordering products)
  const synced = values.join(', ')
  if (splitValues(raw).join('\u0000') !== values.join('\u0000') && synced !== raw) setRaw(synced)
  const own = useFieldError(path)
  const err = own
  const id = `f-${path}`
  return (
    <div className="adm-field">
      <label htmlFor={id}>{label}</label>
      <textarea id={id} className="adm-input" rows={2} value={raw} aria-invalid={!!err} aria-describedby={`${id}-h`} placeholder="e.g. S, M, L, XL"
        onChange={(e) => { setRaw(e.target.value); onChange(splitValues(e.target.value)) }} />
      <div id={`${id}-h`}>
        {err ? <p className="err">{err}</p> : <p className="hint">Separate with commas or new lines. Up to 12.</p>}
        {values.map((v, n) => <ValueError key={n} path={`${path}.${n}`} value={v} />)}
      </div>
    </div>
  )
}

function ValueError({ path, value }: { path: string; value: string }) {
  const err = useFieldError(path)
  return err ? <p className="err">“{value}”: {err}</p> : null
}
