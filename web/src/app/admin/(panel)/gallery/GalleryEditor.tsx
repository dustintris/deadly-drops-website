'use client'

import { useState } from 'react'
import { Check, ImageField, ListEditor, newId, SaveBar, SectionForm, Select, TextField, Uploader, useSection } from '@/components/admin/kit'
import { ALBUMS, type GalleryItemT } from '@/lib/content-schema'

type Album = GalleryItemT['album']
const ALBUM_OPTIONS: { value: Album; label: string }[] = ALBUMS.map((a) => ({
  value: a,
  label: a === 'Community' || a === 'Socials' ? `${a} (also on the Community page)` : a,
}))

/** "IMG_2041-final.jpg" → "IMG 2041 final"; always at least 3 characters so it passes the caption rule. */
function captionFromFile(name: string) {
  const base = name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80)
  return base.length >= 3 ? base : `Photo ${base}`.trim()
}

export function GalleryEditor({ initial, rev }: { initial: GalleryItemT[]; rev: number }) {
  const s = useSection('gallery', initial, rev)
  const list = s.value
  const [bulk, setBulk] = useState(false)
  const [added, setAdded] = useState(0)

  return (
    <SectionForm errors={s.errors}>
      <div className="adm-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <p style={{ marginRight: 'auto' }}>Got a batch of photos from an event? Upload them all at once.</p>
          <button type="button" className="adm-btn" aria-expanded={bulk} aria-controls="bulk-upload" onClick={() => setBulk((b) => !b)}>
            {bulk ? 'Close' : 'Add several photos'}
          </button>
        </div>
        {bulk && (
          <div id="bulk-upload" style={{ display: 'grid', gap: 8 }}>
            <Uploader onUploaded={(img) => {
              setAdded((n) => n + 1)
              s.setValue((prev) => [...prev, {
                id: newId(), image: { src: img.src, alt: img.alt }, caption: captionFromFile(img.label), meta: '',
                album: 'Community', wide: false, visible: false,
              }])
            }} />
            <p className="adm-muted" role="status">
              {added
                ? `${added} photo${added === 1 ? '' : 's'} added to the end of the list below as hidden. Check the captions and descriptions, tick “Show on the site”, then save.`
                : 'Each photo is added to the Community album as hidden, so you can check it before anyone sees it.'}
            </p>
          </div>
        )}
      </div>

      <ListEditor<GalleryItemT>
        path=""
        items={list}
        onChange={s.setValue}
        title={(g) => g.caption}
        thumb={(g) => g.image?.src || undefined}
        startOpen={list.length === 1}
        badge={(g) => (
          <>
            <span className="adm-badge">{g.album}</span>
            {g.wide && <span className="adm-badge">Wide</span>}
            {!g.visible && <span className="adm-badge off">Hidden</span>}
          </>
        )}
        addLabel="Add one photo"
        makeNew={() => ({
          id: newId(), image: { src: '', alt: '' }, caption: 'New photo', meta: '', album: 'Community', wide: false, visible: false,
        })}
        render={(g, i, set) => {
          const p = (k: string) => `${i}.${k}`
          return (
            <>
              <ImageField label="Photo" path={p('image')} required value={g.image.src ? g.image : undefined}
                onChange={(v) => set({ ...g, image: v ?? { src: '', alt: '' } })} />
              <div className="adm-grid">
                <TextField label="Caption" path={p('caption')} value={g.caption} max={80} placeholder="e.g. Gold medal match"
                  onChange={(v) => set({ ...g, caption: v })} />
                <TextField label="Detail" path={p('meta')} value={g.meta} max={40} placeholder="e.g. Spring Open · March 2026"
                  hint="A short line under the caption, like the event or date." onChange={(v) => set({ ...g, meta: v })} />
              </div>
              <div className="adm-grid">
                <Select label="Album" path={p('album')} value={g.album} options={ALBUM_OPTIONS}
                  hint="Community and Socials photos also show on the Community page."
                  onChange={(v) => set({ ...g, album: v ?? 'Community' })} />
                <TextField label="Photographer" path={p('shotBy')} value={g.shotBy ?? ''} max={60} placeholder="Optional"
                  hint="Shown as a credit on the photo." onChange={(v) => set({ ...g, shotBy: v || undefined })} />
              </div>
              <div className="adm-grid">
                <Check label="Show wide (takes two columns)" path={p('wide')} checked={g.wide} hint="Good for landscape group shots."
                  onChange={(v) => set({ ...g, wide: v })} />
                <Check label="Show on the site" path={p('visible')} checked={g.visible} onChange={(v) => set({ ...g, visible: v })} />
              </div>
            </>
          )
        }}
      />
      <SaveBar s={s} />
    </SectionForm>
  )
}
