'use client'

import { Check, ImageField, ListEditor, newId, SaveBar, SectionForm, Select, TextField, useFieldError, useSection } from '@/components/admin/kit'
import { SPONSOR_LEVELS, type SponsorLevel, type SponsorT } from '@/lib/content-schema'
import type { TournamentOption } from '../charities/CharityEditor'

const LEVEL_OPTIONS = SPONSOR_LEVELS.map((value) => ({ value, label: value === 'Title' ? 'Title (the biggest)' : value }))

export function SponsorsEditor({ initial, rev, tournaments }: { initial: SponsorT[]; rev: number; tournaments: TournamentOption[] }) {
  const s = useSection('sponsors', initial, rev)
  const list = s.value
  const hidden = list.filter((x) => !x.visible).length

  return (
    <SectionForm errors={s.errors}>
      <p className="adm-muted" role="status">
        {list.length
          ? `${list.length} ${list.length === 1 ? 'sponsor' : 'sponsors'}${hidden ? ` (${hidden} hidden)` : ''}. The Sponsors page groups them by level; within a level they show in this order.`
          : 'No sponsors yet. Add the first one below.'}
      </p>
      <ListEditor<SponsorT>
        path=""
        items={list}
        onChange={s.setValue}
        title={(x) => x.name}
        thumb={(x) => x.logo?.src}
        startOpen={list.length === 1}
        badge={(x) => (
          <>
            <span className="adm-badge">{x.level}</span>
            {!x.visible && <span className="adm-badge off">Hidden</span>}
            {!x.logo && <span className="adm-badge off">No logo yet</span>}
          </>
        )}
        addLabel="Add sponsor"
        makeNew={() => ({ id: newId(), name: 'New sponsor', level: 'Supporter', blurb: '', website: '', tournaments: [], visible: false })}
        render={(sp, i, set) => <SponsorFields sponsor={sp} i={i} set={set} tournaments={tournaments} />}
      />
      <SaveBar s={s} />
    </SectionForm>
  )
}

function SponsorFields({ sponsor, i, set, tournaments }: {
  sponsor: SponsorT; i: number; set: (v: SponsorT) => void; tournaments: TournamentOption[]
}) {
  const p = (k: string) => `${i}.${k}`
  return (
    <>
      <div className="adm-grid">
        <TextField label="Name" path={p('name')} value={sponsor.name} max={80}
          onChange={(v) => set({ ...sponsor, name: v })} />
        <Select<SponsorLevel> label="Level" path={p('level')} value={sponsor.level} options={LEVEL_OPTIONS}
          hint="Title sponsors get the biggest cards, then Gold, Silver, Bronze and Supporters."
          onChange={(v) => { if (v) set({ ...sponsor, level: v }) }} />
      </div>
      <TextField label="About them (optional)" path={p('blurb')} value={sponsor.blurb} max={280} multiline={3}
        hint="A line or two on their card, e.g. what they do and where (up to 280 characters)."
        onChange={(v) => set({ ...sponsor, blurb: v })} />
      <TextField label="Website (optional)" path={p('website')} value={sponsor.website} type="url" max={500} placeholder="https://"
        hint="Their own site, starting with https://. Their card shows a “Visit …” link and their logo on tournament pages links to it."
        onChange={(v) => set({ ...sponsor, website: v })} />
      <ImageField label="Logo (optional)" path={p('logo')} value={sponsor.logo}
        hint="Shown whole on a light plate, so a logo with a white or see-through background works best. Describe it for screen readers, e.g. “Acme Coffee logo”. Without one, their initials are shown."
        onChange={(v) => set({ ...sponsor, logo: v })} />
      <TournamentPicker path={p('tournaments')} value={sponsor.tournaments} options={tournaments}
        onChange={(v) => set({ ...sponsor, tournaments: v })} />
      <Check label="Show on the site" path={p('visible')} checked={sponsor.visible}
        hint="Untick to hide them everywhere without deleting them."
        onChange={(v) => set({ ...sponsor, visible: v })} />
    </>
  )
}

/** Tick the tournaments this sponsor backs. */
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
      <legend className="lbl" style={{ fontWeight: 600, padding: 0, marginBottom: 6 }}>Tournaments they sponsor</legend>
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
        <p className="hint" id={noteId}>
          Each ticked tournament shows their logo in a &ldquo;Sponsored by&rdquo; row on its page, and their card on the Sponsors
          page links to it. A hidden tournament shows them once it goes live.
        </p>
      )}
    </fieldset>
  )
}
