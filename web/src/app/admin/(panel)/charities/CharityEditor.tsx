'use client'

import { useState } from 'react'
import { cleanSlug, ImageField, ListEditor, newId, SaveBar, SectionForm, slugify, TextField, useFieldError, useSection } from '@/components/admin/kit'
import c from '@/components/community.module.css'
import type { CharityT } from '@/lib/content-schema'
import { RichText } from '@/lib/richtext'

/** A tournament the owner can tick (tournaments live in the database, charities in the website content). */
export type TournamentOption = { slug: string; name: string; dateLabel: string; visible: boolean }

export function CharityEditor({ initial, rev, tournaments }: { initial: CharityT[]; rev: number; tournaments: TournamentOption[] }) {
  const s = useSection('charities', initial, rev)
  const savedIds = new Set(initial.map((x) => x.id))
  const list = s.value

  const freeSlug = () => {
    const taken = new Set(list.map((x) => x.slug))
    let n = list.length + 1
    while (taken.has(`charity-${n}`)) n++
    return `charity-${n}`
  }

  return (
    <SectionForm errors={s.errors}>
      <p className="adm-muted" role="status">
        {list.length ? `${list.length} ${list.length === 1 ? 'charity' : 'charities'}, shown in this order.` : 'No charities yet. Add the first one below.'}
      </p>
      <ListEditor<CharityT>
        path=""
        items={list}
        onChange={s.setValue}
        title={(x) => x.name}
        thumb={(x) => x.logo?.src ?? x.flyer?.src}
        startOpen={list.length === 1}
        badge={(x) => (
          <>
            {!x.flyer && <span className="adm-badge off">No flyer yet</span>}
            {!x.tournaments.length && <span className="adm-badge off">No tournament</span>}
          </>
        )}
        addLabel="Add charity"
        makeNew={() => ({
          id: newId(), slug: freeSlug(), name: 'New charity', tagline: '',
          summary: 'One or two sentences about who this charity helps.', story: '', website: '', tournaments: [],
        })}
        render={(ch, i, set) => <CharityFields charity={ch} i={i} set={set} saved={savedIds.has(ch.id)} tournaments={tournaments} />}
      />
      <SaveBar s={s} />
    </SectionForm>
  )
}

function CharityFields({ charity, i, set, saved, tournaments }: {
  charity: CharityT; i: number; set: (c: CharityT) => void; saved: boolean; tournaments: TournamentOption[]
}) {
  const [preview, setPreview] = useState(false)
  // the web address was typed by hand: the name no longer overwrites it (clearing it hands it back to the name)
  const [ownSlug, setOwnSlug] = useState(false)
  const p = (k: string) => `${i}.${k}`
  // only a new charity takes its web address from the name; a saved one keeps it so links to it never break
  const autoSlug = !saved && !ownSlug
  const trimmedSlug = charity.slug.replace(/^-+|-+$/g, '')
  // the web address is cleaned as they type but trimmed only when they leave the field, so "us4-" can become
  // "us4-warriors". The kit's TextField has no onBlur; leaving either field here bubbles up to this wrapper.
  const trimSlug = () => { if (trimmedSlug !== charity.slug) set({ ...charity, slug: trimmedSlug }) }

  return (
    <>
      <div className="adm-grid" onBlur={trimSlug}>
        <TextField label="Name" path={p('name')} value={charity.name} max={80}
          onChange={(v) => set({ ...charity, name: v, slug: autoSlug && slugify(v) ? slugify(v) : charity.slug })} />
        <TextField label="Web address" path={p('slug')} value={charity.slug} max={60}
          hint={`Its section on the Charity page: /charity/#charity-${trimmedSlug || '…'} (lowercase words with dashes between them).`}
          onChange={(v) => {
            const slug = cleanSlug(v)
            setOwnSlug(slug !== '')
            set({ ...charity, slug })
          }} />
      </div>
      <TextField label="Tagline (optional)" path={p('tagline')} value={charity.tagline} max={120}
        hint="A short line under the name, e.g. their motto."
        onChange={(v) => set({ ...charity, tagline: v })} />
      <TextField label="Summary" path={p('summary')} value={charity.summary} max={240} multiline={3}
        hint="One or two sentences (20 to 240 characters). Shown on the home page card and on the tournament page."
        onChange={(v) => set({ ...charity, summary: v })} />

      <div className="adm-field">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span className="lbl" style={{ fontWeight: 600 }}>Story</span>
          {/* the label says what a press does (no aria-pressed: a changing label and a pressed state would contradict) */}
          <button type="button" className="adm-btn small" aria-controls={`story-${i}`} onClick={() => setPreview((v) => !v)}>
            {preview ? 'Back to editing' : 'Preview'}
          </button>
        </div>
        <div id={`story-${i}`}>
          {preview ? (
            <div className={c.adminPreview} aria-label="Story preview" role="region">
              {charity.story.trim() ? <RichText source={charity.story} /> : <p className="adm-muted">Nothing written yet.</p>}
            </div>
          ) : (
            <TextField label="Full story" path={p('story')} value={charity.story} max={10000} multiline={12}
              hint="Shown in full on the Charity page. Leave a blank line between paragraphs. Formatting: ## Heading, - list item, **bold**, *italic*, [link text](https://…)."
              onChange={(v) => set({ ...charity, story: v })} />
          )}
        </div>
      </div>

      <TextField label="Website" path={p('website')} value={charity.website} type="url" max={500} placeholder="https://"
        hint="The charity's own site, starting with https://. The Charity page shows a “Visit …” button."
        onChange={(v) => set({ ...charity, website: v })} />

      <div className="adm-grid">
        <ImageField label="Logo (optional)" path={p('logo')} value={charity.logo}
          hint="Shown next to the name. Describe it for screen readers, e.g. “Us4Warriors logo”."
          onChange={(v) => set({ ...charity, logo: v })} />
        <ImageField label="Flyer (optional)" path={p('flyer')} value={charity.flyer}
          hint="The charity's flyer. Shown large on the Charity page and next to the tournament's poster on its page."
          onChange={(v) => set({ ...charity, flyer: v })} />
      </div>

      <TournamentPicker path={p('tournaments')} value={charity.tournaments} options={tournaments}
        onChange={(v) => set({ ...charity, tournaments: v })} />
    </>
  )
}

/** Tick the tournaments that play for this charity. */
function TournamentPicker({ path, value, options, onChange }: {
  path: string; value: string[]; options: TournamentOption[]; onChange: (v: string[]) => void
}) {
  const err = useFieldError(path)
  const known = new Set(options.map((o) => o.slug))
  // ticked earlier, but that tournament was deleted or got a new web address: offer to untick it
  const stale = value.filter((slug) => !known.has(slug))
  const toggle = (slug: string, on: boolean) => onChange(on ? [...value.filter((x) => x !== slug), slug] : value.filter((x) => x !== slug))
  const noteId = `f-${path}-h`

  return (
    <fieldset className="adm-field" data-path={path} aria-describedby={noteId} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
      <legend className="lbl" style={{ fontWeight: 600, padding: 0, marginBottom: 6 }}>Tournaments playing for this charity</legend>
      {options.length === 0 && <p className="adm-muted">No tournaments yet. Add one under Tournaments first.</p>}
      {options.map((o, k) => (
        <label key={o.slug} className="adm-check">
          <input id={k === 0 ? `f-${path}` : `f-${path}-${o.slug}`} type="checkbox" checked={value.includes(o.slug)}
            onChange={(e) => toggle(o.slug, e.target.checked)} />
          {' '}{o.name} <span className="adm-muted">· {o.dateLabel}{o.visible ? '' : ' · hidden'}</span>
        </label>
      ))}
      {stale.map((slug) => (
        <label key={slug} className="adm-check">
          <input type="checkbox" checked onChange={() => toggle(slug, false)} />
          {' '}{slug} <span className="adm-muted">· no tournament has this web address any more: untick to remove it</span>
        </label>
      ))}
      {/* the error is read out when it appears, and both it and the hint belong to the group */}
      {err ? <p className="err" id={noteId} role="alert">{err}</p> : (
        <p className="hint" id={noteId}>Each ticked tournament shows a “Playing for …” block with this charity on its page.</p>
      )}
    </fieldset>
  )
}
