'use client'

import { Check, ImageField, LinesField, ListEditor, MoneyField, newId, SaveBar, SectionForm, slugify, TextField, useSection } from '@/components/admin/kit'
import type { ClubEventT } from '@/lib/content-schema'

const PLACES = ['Gold', 'Silver', 'Bronze'] as const

function autoLabel(date: string | null) {
  if (!date) return 'Date to be announced'
  const d = new Date(`${date}T12:00:00`)
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

export function EventsEditor({ initial, rev }: { initial: ClubEventT[]; rev: number }) {
  const s = useSection('events', initial, rev)
  const list = s.value

  return (
    <SectionForm errors={s.errors}>
      <ListEditor<ClubEventT>
        path=""
        items={list}
        onChange={s.setValue}
        title={(e) => e.name}
        startOpen={list.length === 1}
        badge={(e) => (
          <>
            {e.featured && <span className="adm-badge on">Featured</span>}
            <span className={`adm-badge ${e.registrationOpen ? 'on' : 'off'}`}>{e.registrationOpen ? 'Registration open' : 'Closed'}</span>
            {!e.visible && <span className="adm-badge off">Hidden</span>}
          </>
        )}
        addLabel="Add tournament"
        makeNew={() => ({
          id: newId(), slug: `tournament-${list.length + 1}`, name: 'New tournament', summary: 'Describe the tournament in a sentence or two.',
          date: null, dateLabel: 'Date to be announced', entryFee: 55, includes: [], format: 'Round robin into a medal round',
          prizes: [], registrationOpen: false, featured: false, visible: false,
        })}
        render={(e, i, set) => {
          const p = (k: string) => `${i}.${k}`
          return (
            <>
              <div className="adm-grid">
                <TextField label="Name" path={p('name')} value={e.name} max={80}
                  onChange={(v) => set({ ...e, name: v, slug: e.slug.startsWith('tournament-') || e.slug === slugify(e.name) ? slugify(v) : e.slug })} />
                <TextField label="Web address" path={p('slug')} value={e.slug} hint="Lowercase words with dashes." onChange={(v) => set({ ...e, slug: slugify(v) })} />
              </div>
              <TextField label="Summary" path={p('summary')} value={e.summary} max={200} multiline={2} onChange={(v) => set({ ...e, summary: v })} />
              <fieldset className="adm-card" style={{ border: '1px solid rgb(var(--ink-dark-rgb) / .1)' }}>
                <legend className="lbl" style={{ fontWeight: 700, padding: '0 6px' }}>When and where</legend>
                <div className="adm-grid">
                  <div className="adm-field">
                    <label htmlFor={`f-${p('date')}`}>Date</label>
                    <input id={`f-${p('date')}`} type="date" className="adm-input" value={e.date ?? ''}
                      onChange={(ev) => { const d = ev.target.value || null; set({ ...e, date: d, dateLabel: autoLabel(d) }) }} />
                    <p className="hint">Leave empty while the date is not announced.</p>
                  </div>
                  <TextField label="Date shown on the site" path={p('dateLabel')} value={e.dateLabel} max={60} onChange={(v) => set({ ...e, dateLabel: v })} />
                  <TextField label="Start time" path={p('startTime')} type="time" value={e.startTime ?? ''} onChange={(v) => set({ ...e, startTime: v || undefined })} />
                  <TextField label="Location" path={p('location')} value={e.location ?? ''} max={120} placeholder="Courts and address" onChange={(v) => set({ ...e, location: v || undefined })} />
                </div>
              </fieldset>
              <fieldset className="adm-card" style={{ border: '1px solid rgb(var(--ink-dark-rgb) / .1)' }}>
                <legend className="lbl" style={{ fontWeight: 700, padding: '0 6px' }}>Prices and prizes</legend>
                <div className="adm-grid">
                  <MoneyField label="Entry fee per player" path={p('entryFee')} value={e.entryFee} onChange={(v) => set({ ...e, entryFee: v ?? 0 })} />
                  <MoneyField label="Entry fee with meal" path={p('entryFeeWithMeal')} optional value={e.entryFeeWithMeal} hint="Leave empty if there is no meal option."
                    onChange={(v) => set({ ...e, entryFeeWithMeal: v })} />
                </div>
                <div className="adm-grid">
                  {PLACES.map((place) => {
                    const prize = e.prizes.find((x) => x.place === place)
                    return (
                      <MoneyField key={place} label={`${place} prize`} path={p(`prizes.${e.prizes.findIndex((x) => x.place === place)}.amount`)} optional
                        value={prize?.amount} hint="Empty = no cash prize for this place."
                        onChange={(v) => set({ ...e, prizes: PLACES.flatMap((pl) => { const amt = pl === place ? v : e.prizes.find((x) => x.place === pl)?.amount; return amt === undefined ? [] : [{ place: pl, amount: amt }] }) })} />
                    )
                  })}
                </div>
                <LinesField label="What's included" path={p('includes')} value={e.includes} max={8} onChange={(v) => set({ ...e, includes: v })} hint="One per line, e.g. Tournament shirt." />
                <TextField label="Format" path={p('format')} value={e.format} max={120} onChange={(v) => set({ ...e, format: v })} />
              </fieldset>
              <fieldset className="adm-card" style={{ border: '1px solid rgb(var(--ink-dark-rgb) / .1)' }}>
                <legend className="lbl" style={{ fontWeight: 700, padding: '0 6px' }}>Registration</legend>
                <Check label="Registration is open" path={p('registrationOpen')} checked={e.registrationOpen} onChange={(v) => set({ ...e, registrationOpen: v })} />
                <TextField label="Registration link" path={p('registrationUrl')} value={e.registrationUrl ?? ''} placeholder="https://…"
                  hint="Where players sign up and pay. When set, every Register button goes there." onChange={(v) => set({ ...e, registrationUrl: v || undefined })} />
              </fieldset>
              <ImageField label="Poster or photo" path={p('image')} value={e.image} onChange={(v) => set({ ...e, image: v })} />
              <div className="adm-grid">
                <Check label="Feature on the homepage" path={p('featured')} checked={e.featured}
                  onChange={(v) => s.setValue(list.map((x, k) => ({ ...x, featured: k === i ? v : v ? false : x.featured })))} />
                <Check label="Show on the site" path={p('visible')} checked={e.visible} onChange={(v) => set({ ...e, visible: v })} />
              </div>
            </>
          )
        }}
      />
      <SaveBar s={s} />
    </SectionForm>
  )
}
