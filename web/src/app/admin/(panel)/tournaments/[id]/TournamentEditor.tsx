'use client'

/**
 * One tournament: basics, days, details, divisions and game rules, saved together by one Save.
 * saveTournamentAction checks the version this screen loaded, so two editors can't overwrite each
 * other. The fields and their error display come from the kit; the state and save live here
 * because useSection is tied to the website-content sections. There is no <form> element: the
 * kit's image picker has plain buttons that would submit it.
 */
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { saveTournamentAction, type TournamentResult } from '@/app/admin/tournament-actions'
import { Check, ImageField, LinesField, MoneyField, NumberField, SaveBar, SectionForm, Select, TextField, useFieldError } from '@/components/admin/kit'
import { newId } from '@/lib/content-schema'
import { addDaysIso, autoDateLabel, dayLabel } from '@/lib/tournaments/days'
import type { Tournament } from '@/lib/tournaments/repo'
import {
  BRONZE,
  BRONZE_LABELS,
  DIVISION_FORMATS,
  FORMAT_LABELS,
  PLAYOFF_LABELS,
  PLAYOFFS,
  TIEBREAKER_LABELS,
  TIEBREAKERS,
  type DivisionInputT,
  type InfoT,
  type RulesT,
  type Tiebreaker,
  type TournamentInputT,
} from '@/lib/tournaments/schema'
import { asset } from '@/lib/utils'

type Errors = Record<string, string>
type DayRow = { key: string; date: string }
/** A division on screen: its day is held by the day's key, so sorting or removing days never mixes them up. */
type DivRow = Omit<DivisionInputT, 'dayIndex'> & { key: string; dayKey: string }
type RuleNote = RulesT['notes'][number]
type Form = {
  name: string
  slug: string
  featured: boolean
  visible: boolean
  days: DayRow[]
  /** the date label follows the days until someone types their own */
  autoLabel: boolean
  info: InfoT
  rules: RulesT
  divisions: DivRow[]
}

const PLACES = ['Gold', 'Silver', 'Bronze'] as const
const MAX_DAYS = 7
const MAX_DIVISIONS = 40
const MAX_NOTES = 20
const CLUB_TZ = 'America/Los_Angeles'
const NO_ERRORS: Errors = {}
const SUB: React.CSSProperties = { border: '1px solid rgb(var(--ink-dark-rgb) / .1)' }
const LEGEND: React.CSSProperties = { fontWeight: 700, padding: '0 6px' }

/* ---------- helpers ---------- */

const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s)
// a day whose date isn't picked yet goes last
const byDate = (a: DayRow, b: DayRow) => (a.date || '~').localeCompare(b.date || '~')
function sortedDays(days: DayRow[]): DayRow[] {
  const next = [...days].sort(byDate)
  return next.every((d, i) => d === days[i]) ? days : next
}

function todayInClub(): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: CLUB_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]))
  return `${p.year}-${p.month}-${p.day}`
}

/** Lowercase words and dashes as they type; a trailing dash is allowed until it is saved. */
const cleanSlug = (v: string) =>
  v.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+/, '').slice(0, 60)

const courtsLabel = (d: { firstCourt: number; courtCount: number }) =>
  !(d.firstCourt >= 1 && d.courtCount >= 1)
    ? 'Courts: check the numbers'
    : d.courtCount === 1
      ? `Court ${d.firstCourt}`
      : `Courts ${d.firstCourt}–${d.firstCourt + d.courtCount - 1}`

function fromTournament(t: Tournament): Form {
  // keys from the data (not random) so the server and browser render the same ids
  const days = t.days.map((date) => ({ key: `day-${date}`, date }))
  return {
    name: t.name,
    slug: t.slug,
    featured: t.featured,
    visible: t.visible,
    days,
    autoLabel: t.info.dateLabel === autoDateLabel(t.days),
    info: t.info,
    rules: t.rules,
    divisions: t.divisions.map((d) => ({
      key: `div-${d.id}`,
      id: d.id,
      dayKey: (days[d.dayIndex] ?? days[0])?.key ?? '',
      name: d.name,
      format: d.format,
      startTime: d.startTime,
      minutesPerRound: d.minutesPerRound,
      firstCourt: d.firstCourt,
      courtCount: d.courtCount,
      teamLimit: d.teamLimit,
      gamesTo: d.gamesTo,
      gamesPerTeam: d.gamesPerTeam,
      playoffs: d.playoffs,
      bronze: d.bronze,
    })),
  }
}

/** What the server gets: days in order, each division's day as its position, existing division ids kept. */
function toPayload(f: Form): TournamentInputT {
  const days = [...f.days].sort(byDate)
  const dates = days.map((d) => d.date)
  return {
    name: f.name,
    slug: f.slug.replace(/-+$/, ''),
    days: dates,
    featured: f.featured,
    visible: f.visible,
    info: { ...f.info, dateLabel: f.autoLabel ? autoDateLabel(dates.filter(isDate)) : f.info.dateLabel },
    rules: f.rules,
    divisions: f.divisions.map(({ key: _key, dayKey, ...d }) => ({ ...d, dayIndex: Math.max(0, days.findIndex((x) => x.key === dayKey)) })),
  }
}

/** JSON with object keys sorted: the database reorders keys, and that is not a change. */
const canon = (v: unknown) =>
  JSON.stringify(v, (_k, x: unknown) =>
    x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) : x,
  )

/** Server errors follow the saved shape; prizes are shown by place, so their errors are keyed by place. */
function remapErrors(errors: Errors, sent: TournamentInputT): Errors {
  const out: Errors = {}
  for (const [k, v] of Object.entries(errors)) {
    const m = /^info\.prizes\.(\d+)/.exec(k)
    out[m ? `info.prizes.${sent.info.prizes[Number(m[1])]?.place ?? 'Gold'}` : k] ??= v
  }
  return out
}

/** Focus the field an error belongs to, or the nearest group that has one ('days.2' → 'days'). */
function focusFirstError(key: string) {
  requestAnimationFrame(() => {
    const parts = key.split('.')
    for (let n = parts.length; n > 0; n--) {
      const el = document.getElementById(`f-${parts.slice(0, n).join('.')}`)
      if (el) {
        el.focus()
        el.scrollIntoView({ block: 'center' })
        return
      }
    }
  })
}

const focusById = (id: string, fallback?: HTMLElement | null) =>
  requestAnimationFrame(() => (document.getElementById(id) ?? fallback)?.focus())

const hasErrorAt = (errors: Errors, path: string, i: number) =>
  Object.keys(errors).some((k) => k === `${path}.${i}` || k.startsWith(`${path}.${i}.`))

/** A link that asks before leaving with unsaved changes (the editor marks the page, like AdminNav checks). */
export function LeaveLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href}
      onClick={(e) => { if (document.body.dataset.unsaved && !window.confirm('You have unsaved changes on this screen. Leave without saving?')) e.preventDefault() }}>
      {children}
    </Link>
  )
}

/* ---------- the editor ---------- */

export function TournamentEditor({ initial, canEdit }: { initial: Tournament; canEdit: boolean }) {
  const [form, setFormRaw] = useState(() => fromTournament(initial))
  const [saved, setSaved] = useState(() => canon(toPayload(fromTournament(initial))))
  const [version, setVersion] = useState(initial.version)
  const [live, setLive] = useState({ slug: initial.slug, visible: initial.visible })
  const [errors, setErrors] = useState<Errors>(NO_ERRORS)
  const [result, setResult] = useState<TournamentResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [announcement, setAnnouncement] = useState('')
  const addDayRef = useRef<HTMLButtonElement>(null)
  const dirty = canEdit && canon(toPayload(form)) !== saved

  const adopt = (t: Tournament) => {
    const fresh = fromTournament(t)
    setSaved(canon(toPayload(fresh)))
    setVersion(t.version)
    setLive({ slug: t.slug, visible: t.visible })
    return fresh
  }

  // a newer copy from the server (someone else's save, a refresh): take it unless mid-edit
  const [seenVersion, setSeenVersion] = useState(initial.version)
  if (initial.version !== seenVersion) {
    setSeenVersion(initial.version)
    if (initial.version > version && !dirty) setFormRaw(adopt(initial))
  }

  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', warn)
    document.body.dataset.unsaved = '1' // AdminNav asks before leaving
    return () => { window.removeEventListener('beforeunload', warn); delete document.body.dataset.unsaved }
  }, [dirty])

  // editing clears old messages (server errors are keyed by position and go stale after a reorder)
  const setForm = (fn: (f: Form) => Form) => { setFormRaw(fn); setErrors(NO_ERRORS); setResult(null) }
  const setInfo = (patch: Partial<InfoT>) => setForm((f) => ({ ...f, info: { ...f.info, ...patch } }))
  const setRules = (patch: Partial<RulesT>) => setForm((f) => ({ ...f, rules: { ...f.rules, ...patch } }))
  // the same text twice is not read out again, so nudge it
  const say = (msg: string) => setAnnouncement((prev) => (prev === msg ? `${msg} ` : msg))

  const save = async () => {
    if (!canEdit || busy) return
    const ordered = sortedDays(form.days)
    const current = ordered === form.days ? form : { ...form, days: ordered }
    if (current !== form) setFormRaw(current)
    const sent = toPayload(current)
    const sentKey = canon(sent)
    setBusy(true)
    setResult(null)
    let res: TournamentResult
    try {
      res = await saveTournamentAction(initial.id, sent, version)
    } catch {
      res = { ok: false, message: 'Could not reach the server. Check your connection, or sign in again, then save.' }
    } finally {
      setBusy(false)
    }
    const errs = res.errors ? remapErrors(res.errors, sent) : NO_ERRORS
    setResult(res)
    setErrors(errs)
    if (res.ok && res.tournament) {
      const fresh = adopt(res.tournament)
      setSeenVersion(res.tournament.version)
      // the server's copy (trimmed text, ids for new divisions), unless they kept typing while it saved;
      // then keep their edits but give the divisions just created their new ids, so the next save updates them
      const saved = res.tournament
      const savedIds = new Map(current.divisions.map((d, i) => [d.key, saved.divisions[i]?.id]))
      setFormRaw((f) => (canon(toPayload(f)) === sentKey
        ? fresh
        : { ...f, divisions: f.divisions.map((d) => (d.id === undefined && savedIds.get(d.key) !== undefined ? { ...d, id: savedIds.get(d.key) } : d)) }))
    } else {
      // a stale version or a server failure keeps every edit; only the message shows
      const first = Object.keys(errs)[0]
      if (first) focusFirstError(first)
    }
  }

  /* days */
  const { info, rules } = form
  const multiDay = form.days.length > 1
  const autoLabel = autoDateLabel(form.days.map((d) => d.date).filter(isDate))
  const dayTitle = (d: DayRow | undefined, i: number) => `Day ${i + 1}${d && isDate(d.date) ? ` (${dayLabel(d.date)})` : ''}`
  const dateCounts = new Map<string, number>()
  for (const d of form.days) if (d.date) dateCounts.set(d.date, (dateCounts.get(d.date) ?? 0) + 1)

  const addDay = () => {
    if (form.days.length >= MAX_DAYS) { say(`A tournament can have up to ${MAX_DAYS} days.`); return }
    const taken = new Set(form.days.map((d) => d.date))
    const known = form.days.map((d) => d.date).filter(isDate).sort()
    let date = known.length ? addDaysIso(known[known.length - 1], 1) : todayInClub()
    while (taken.has(date)) date = addDaysIso(date, 1)
    const row = { key: newId(), date }
    const next = sortedDays([...form.days, row])
    setForm((f) => ({ ...f, days: next }))
    say(`Day added: ${dayLabel(date)}.`)
    focusById(`f-days.${next.indexOf(row)}`)
  }

  const removeDay = (i: number) => {
    const day = form.days[i]
    const label = dayTitle(day, i)
    const moved = form.divisions.filter((d) => d.dayKey === day.key).length
    const moves = multiDay && moved > 0
    if (moves && !window.confirm(`Remove ${label}? ${moved === 1 ? 'Its division moves' : `Its ${moved} divisions move`} to day 1.`)) return
    setForm((f) => {
      const days = f.days.filter((d) => d.key !== day.key)
      const first = sortedDays(days)[0]?.key ?? ''
      return { ...f, days, divisions: f.divisions.map((d) => (d.dayKey === day.key ? { ...d, dayKey: first } : d)) }
    })
    say(`${label} removed.${moves ? ` ${moved === 1 ? 'Its division is' : `${moved} divisions are`} now on day 1.` : ''}`)
    focusById(`f-days.${Math.min(i, form.days.length - 2)}`, addDayRef.current)
  }

  // dates are put in order when focus leaves the list (not while typing, so a row doesn't jump mid-edit)
  const sortDaysOnLeave = (e: React.FocusEvent<HTMLDivElement>) => {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
    setFormRaw((f) => {
      const days = sortedDays(f.days)
      return days === f.days ? f : { ...f, days }
    })
  }

  /* divisions */
  const dayIndexOf = (d: DivRow) => Math.max(0, form.days.findIndex((x) => x.key === d.dayKey))
  const newDivision = (): DivRow => {
    const last = form.divisions[form.divisions.length - 1]
    const names = new Set(form.divisions.map((d) => d.name.trim().toLowerCase()))
    let name = 'New division'
    for (let n = 2; names.has(name.toLowerCase()); n++) name = `New division ${n}`
    return {
      key: newId(),
      name,
      format: last?.format ?? 'mixed',
      dayKey: last?.dayKey ?? form.days[0]?.key ?? '',
      startTime: info.startTime || last?.startTime || '08:00',
      minutesPerRound: last?.minutesPerRound ?? 20,
      firstCourt: 1,
      courtCount: last?.courtCount ?? 4,
      teamLimit: null,
      gamesTo: null,
      gamesPerTeam: null,
      playoffs: last?.playoffs ?? 'top4',
      bronze: last?.bronze ?? 'standings',
    }
  }

  const slugShown = form.slug.replace(/-+$/, '') || '…'

  return (
    <SectionForm errors={errors}>
      <p className="sr" role="status" aria-live="polite">{announcement}</p>

      <section className="adm-card" aria-labelledby="tb-basics">
        <h2 id="tb-basics">Basics</h2>
        <div className="adm-grid">
          <TextField label="Tournament name" path="name" value={form.name} max={80} onChange={(v) => setForm((f) => ({ ...f, name: v }))} />
          <TextField label="Web address" path="slug" value={form.slug} max={60}
            hint={`The page is at /tournaments/${slugShown}/. Lowercase words with dashes.${live.visible ? ' Changing it breaks links people already shared.' : ''}`}
            onChange={(v) => setForm((f) => ({ ...f, slug: cleanSlug(v) }))} />
        </div>
        <div className="adm-grid">
          <Check label="Show on the website" path="visible" checked={form.visible} hint="Untick to keep it as a hidden draft."
            onChange={(v) => setForm((f) => ({ ...f, visible: v }))} />
          <Check label="Feature on the home page" path="featured" checked={form.featured} hint="Only one tournament is featured: saving this one un-features the others."
            onChange={(v) => setForm((f) => ({ ...f, featured: v }))} />
        </div>
        {live.visible && (
          <p>
            <a className="adm-btn small" href={asset(`/tournaments/${live.slug}/`)} target="_blank" rel="noopener">
              View on the website ↗<span className="sr"> (opens in a new tab)</span>
            </a>
          </p>
        )}
      </section>

      <section className="adm-card" aria-labelledby="tb-days">
        <h2 id="tb-days">Days</h2>
        <p className="adm-muted">
          Add each day of play. Leave the list empty while the date isn’t announced.
          {multiDay && ' Removing a day moves its divisions to day 1.'}
        </p>
        <DaysError />
        <div id="f-days" tabIndex={-1} role="group" aria-labelledby="tb-days" onBlur={sortDaysOnLeave} style={{ display: 'grid', gap: 12 }}>
          {form.days.length > 0 && (
            <ol style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 10 }}>
              {form.days.map((d, i) => (
                <DayItem key={d.key} day={d} i={i} title={dayTitle(d, i)} duplicate={(dateCounts.get(d.date) ?? 0) > 1}
                  onChange={(date) => setForm((f) => ({ ...f, days: f.days.map((x) => (x.key === d.key ? { ...x, date } : x)) }))}
                  onRemove={() => removeDay(i)} />
              ))}
            </ol>
          )}
          <div>
            <button ref={addDayRef} type="button" className="adm-btn" aria-disabled={form.days.length >= MAX_DAYS} onClick={addDay}>+ Add a day</button>
          </div>
        </div>
        <TextField label="Date shown on the website" path="info.dateLabel" max={60}
          value={form.autoLabel ? autoLabel : info.dateLabel}
          hint={form.autoLabel ? 'Follows the days automatically. Type to write your own.' : 'Your own wording. It no longer follows the days.'}
          onChange={(v) => setForm((f) => ({ ...f, autoLabel: false, info: { ...f.info, dateLabel: v } }))} />
        {!form.autoLabel && (
          <div>
            <button type="button" className="adm-btn small"
              onClick={() => { setForm((f) => ({ ...f, autoLabel: true })); say(`Date label set to ${autoLabel}.`) }}>
              Use automatic label: “{autoLabel}”
            </button>
          </div>
        )}
      </section>

      <section className="adm-card" aria-labelledby="tb-details">
        <h2 id="tb-details">Details</h2>
        <TextField label="Summary" path="info.summary" value={info.summary} max={200} multiline={2}
          hint="A sentence or two for the tournament card and page." onChange={(v) => setInfo({ summary: v })} />
        <div className="adm-grid">
          <TextField label="Venue" path="info.venue" value={info.venue ?? ''} max={120} placeholder="Courts and address" onChange={(v) => setInfo({ venue: v })} />
          <TextField label="Start time" path="info.startTime" type="time" value={info.startTime ?? ''} hint="When play starts. Optional."
            onChange={(v) => setInfo({ startTime: v || undefined })} />
        </div>
        <fieldset className="adm-card" style={SUB}>
          <legend className="lbl" style={LEGEND}>Prices and prizes</legend>
          <div className="adm-grid">
            <MoneyField label="Entry fee per player" path="info.entryFee" value={info.entryFee} onChange={(v) => setInfo({ entryFee: v ?? 0 })} />
            <MoneyField label="Price with a meal" path="info.entryFeeWithMeal" optional value={info.entryFeeWithMeal} hint="Leave empty if there is no meal option."
              onChange={(v) => setInfo({ entryFeeWithMeal: v })} />
          </div>
          <div className="adm-grid" id="f-info.prizes" tabIndex={-1}>
            {PLACES.map((place) => (
              <MoneyField key={place} label={`${place} prize`} path={`info.prizes.${place}`} optional
                value={info.prizes.find((x) => x.place === place)?.amount} hint="Empty = no cash prize for this place."
                onChange={(v) => setInfo({
                  prizes: PLACES.flatMap((pl) => {
                    const amount = pl === place ? v : info.prizes.find((x) => x.place === pl)?.amount
                    return amount === undefined ? [] : [{ place: pl, amount }]
                  }),
                })} />
            ))}
          </div>
          <LinesField label="What’s included" path="info.includes" value={info.includes} max={8} hint="One per line, e.g. Tournament shirt."
            onChange={(v) => setInfo({ includes: v })} />
          <TextField label="Format summary" path="info.format" value={info.format} max={120} hint="One line, e.g. Round robin into a medal round."
            onChange={(v) => setInfo({ format: v })} />
        </fieldset>
        <fieldset className="adm-card" style={SUB}>
          <legend className="lbl" style={LEGEND}>Registration</legend>
          <Check label="Registration is open" path="info.registrationOpen" checked={info.registrationOpen} onChange={(v) => setInfo({ registrationOpen: v })} />
          <TextField label="Registration link" path="info.registrationUrl" value={info.registrationUrl ?? ''} placeholder="https://…"
            hint="Where players sign up and pay. When set, every Register button goes there."
            onChange={(v) => setInfo({ registrationUrl: v || undefined })} />
        </fieldset>
        <div className="adm-grid">
          <ImageField label="Poster or photo" path="info.image" value={info.image} onChange={(v) => setInfo({ image: v })} />
          <ImageField label="Tournament logo" path="info.logo" value={info.logo} hint="Shown on the tournament page and its cards; the club logo is used when empty."
            onChange={(v) => setInfo({ logo: v })} />
        </div>
      </section>

      <section className="adm-card" aria-labelledby="tb-divisions">
        <h2 id="tb-divisions">Divisions ({form.divisions.length})</h2>
        <p className="adm-muted">Each division plays on its own day and courts. Use the arrows to set the order they are listed in.</p>
        <div id="f-divisions" tabIndex={-1}>
          <Rows<DivRow>
            path="divisions"
            items={form.divisions}
            errors={errors}
            keyOf={(d) => d.key}
            title={(d) => d.name.trim() || 'Untitled division'}
            summary={(d) => [
              FORMAT_LABELS[d.format],
              multiDay ? `Day ${dayIndexOf(d) + 1}` : null,
              d.startTime || 'no start time',
              courtsLabel(d),
              d.teamLimit ? `up to ${d.teamLimit} teams` : null,
            ].filter(Boolean).join(' · ')}
            onChange={(divisions) => setForm((f) => ({ ...f, divisions }))}
            makeNew={form.divisions.length < MAX_DIVISIONS ? newDivision : undefined}
            limitNote={`A tournament can have up to ${MAX_DIVISIONS} divisions.`}
            addLabel="Add a division"
            focusField="name"
            noun="division"
            removeNote="It is deleted when you save."
            say={say}
            render={(d, i, set) => {
              const p = (k: string) => `divisions.${i}.${k}`
              return (
                <>
                  <div className="adm-grid">
                    <TextField label="Division name" path={p('name')} value={d.name} max={60} placeholder="e.g. Mixed 3.5" onChange={(v) => set({ ...d, name: v })} />
                    <Select label="Format" path={p('format')} value={d.format}
                      options={DIVISION_FORMATS.map((v) => ({ value: v, label: FORMAT_LABELS[v] }))}
                      onChange={(v) => { if (v) set({ ...d, format: v }) }} />
                    {multiDay && (
                      <Select label="Day" path={p('dayIndex')} value={form.days[dayIndexOf(d)]?.key}
                        options={form.days.map((x, k) => ({ value: x.key, label: dayTitle(x, k) }))}
                        onChange={(v) => { if (v) set({ ...d, dayKey: v }) }} />
                    )}
                  </div>
                  <div className="adm-grid">
                    <TextField label="Start time" path={p('startTime')} type="time" value={d.startTime} onChange={(v) => set({ ...d, startTime: v })} />
                    <NumberField label="Minutes per round" path={p('minutesPerRound')} min={5} max={120} value={d.minutesPerRound}
                      onChange={(v) => set({ ...d, minutesPerRound: v ?? 0 })} />
                    <NumberField label="Team limit" path={p('teamLimit')} min={2} max={64} allowEmpty value={d.teamLimit} hint="Empty = no limit."
                      onChange={(v) => set({ ...d, teamLimit: v })} />
                  </div>
                  <fieldset className="adm-card" style={SUB}>
                    <legend className="lbl" style={LEGEND}>Courts</legend>
                    <div className="adm-grid">
                      <NumberField label="First court" path={p('firstCourt')} min={1} max={99} value={d.firstCourt} onChange={(v) => set({ ...d, firstCourt: v ?? 0 })} />
                      <NumberField label="Number of courts" path={p('courtCount')} min={1} max={40} value={d.courtCount} onChange={(v) => set({ ...d, courtCount: v ?? 0 })} />
                    </div>
                    <p style={{ fontWeight: 600 }}>{courtsLabel(d)}</p>
                  </fieldset>
                  <fieldset className="adm-card" style={SUB}>
                    <legend className="lbl" style={LEGEND}>Override game rules</legend>
                    <p className="adm-muted">Leave the numbers empty to use the tournament’s game rules.</p>
                    <div className="adm-grid">
                      <NumberField label="Points to win" path={p('gamesTo')} min={5} max={50} allowEmpty value={d.gamesTo}
                        hint={`Empty = ${rules.gamesTo}, the tournament’s rule.`} onChange={(v) => set({ ...d, gamesTo: v })} />
                      <NumberField label="Games per team" path={p('gamesPerTeam')} min={1} max={30} allowEmpty value={d.gamesPerTeam}
                        hint={`Empty = ${rules.gamesPerTeam}, the tournament’s rule.`} onChange={(v) => set({ ...d, gamesPerTeam: v })} />
                    </div>
                    <div className="adm-grid">
                      <Select label="Playoffs" path={p('playoffs')} value={d.playoffs}
                        options={PLAYOFFS.map((v) => ({ value: v, label: PLAYOFF_LABELS[v] }))}
                        // without playoffs there are no semifinal losers to play for bronze
                        onChange={(v) => { if (v) set({ ...d, playoffs: v, bronze: v === 'none' ? 'standings' : d.bronze }) }} />
                      {d.playoffs !== 'none' && (
                        <Select label="Bronze medal" path={p('bronze')} value={d.bronze}
                          options={BRONZE.map((v) => ({ value: v, label: BRONZE_LABELS[v] }))}
                          onChange={(v) => { if (v) set({ ...d, bronze: v }) }} />
                      )}
                    </div>
                    {d.playoffs !== 'none' && (
                      <p className="adm-muted">The bracket is drawn from the final pool standings the moment the last pool game goes final, and winners move on by themselves. Medals come from the final{d.bronze === 'match' ? ' and the bronze match' : ''}.</p>
                    )}
                  </fieldset>
                </>
              )
            }}
          />
        </div>
      </section>

      <section className="adm-card" aria-labelledby="tb-rules">
        <h2 id="tb-rules">Game rules</h2>
        <p className="adm-muted">These apply to every division unless the division overrides them.</p>
        <div className="adm-grid">
          <NumberField label="Points to win" path="rules.gamesTo" min={5} max={50} value={rules.gamesTo} onChange={(v) => setRules({ gamesTo: v ?? 0 })} />
          <NumberField label="Games per team" path="rules.gamesPerTeam" min={1} max={30} value={rules.gamesPerTeam} hint="Round-robin games each team plays."
            onChange={(v) => setRules({ gamesPerTeam: v ?? 0 })} />
          <NumberField label="Playoff points to win" path="rules.playoffGamesTo" min={5} max={50} value={rules.playoffGamesTo}
            onChange={(v) => setRules({ playoffGamesTo: v ?? 0 })} />
        </div>
        <Check label="Win by 2" path="rules.winBy2" checked={rules.winBy2} hint="Unticked: the first team to the points wins, even 11–10."
          onChange={(v) => setRules({ winBy2: v })} />
        <TiebreakOrder value={rules.tiebreakers} onChange={(tiebreakers) => setRules({ tiebreakers })} say={say} />
        <div id="f-rules.notes" tabIndex={-1} role="group" aria-labelledby="tb-notes" style={{ display: 'grid', gap: 8 }}>
          <h3 id="tb-notes">Rule notes</h3>
          <p className="adm-muted">Shown on the tournament page, e.g. DUPR policy, timing, what to bring.</p>
          <Rows<RuleNote>
            path="rules.notes"
            items={rules.notes}
            errors={errors}
            keyOf={(n) => n.id}
            title={(n) => n.title.trim() || 'Untitled rule'}
            onChange={(notes) => setRules({ notes })}
            makeNew={rules.notes.length < MAX_NOTES ? () => ({ id: newId(), title: '', text: '' }) : undefined}
            limitNote={`Up to ${MAX_NOTES} rule notes.`}
            addLabel="Add a rule note"
            focusField="title"
            noun="rule note"
            removeNote="It is deleted when you save."
            say={say}
            render={(n, i, set) => (
              <>
                <TextField label="Title" path={`rules.notes.${i}.title`} value={n.title} max={60} placeholder="e.g. DUPR ratings" onChange={(v) => set({ ...n, title: v })} />
                <TextField label="Text" path={`rules.notes.${i}.text`} value={n.text} max={1000} multiline={4} onChange={(v) => set({ ...n, text: v })} />
              </>
            )}
          />
        </div>
      </section>

      <SaveBar s={{ save, dirty, busy, result }} label="Save tournament" />
    </SectionForm>
  )
}

/* ---------- pieces ---------- */

function DaysError() {
  const err = useFieldError('days')
  return err ? <p className="err" role="alert" style={{ color: 'var(--danger-on-light)', fontWeight: 600 }}>{err}</p> : null
}

function DayItem({ day, i, title, duplicate, onChange, onRemove }: {
  day: DayRow; i: number; title: string; duplicate: boolean; onChange: (date: string) => void; onRemove: () => void
}) {
  const id = `f-days.${i}`
  const serverErr = useFieldError(`days.${i}`)
  const err = serverErr ?? (duplicate ? 'This date is listed twice.' : !day.date ? 'Pick a date, or remove this day.' : undefined)
  return (
    <li style={{ display: 'flex', alignItems: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
      <div className="adm-field" style={{ flex: '1 1 220px', minWidth: 0 }}>
        <label htmlFor={id}>{title}</label>
        <input id={id} type="date" className="adm-input" value={day.date} aria-invalid={!!err} aria-describedby={err ? `${id}-err` : undefined}
          onChange={(e) => onChange(e.target.value)} />
        {err && <p className="err" id={`${id}-err`}>{err}</p>}
      </div>
      <button type="button" className="adm-btn danger" onClick={onRemove}>Remove<span className="sr"> {title}</span></button>
    </li>
  )
}

/** The tiebreakers in the order they are applied; each can be moved, dropped and added back. */
function TiebreakOrder({ value, onChange, say }: { value: Tiebreaker[]; onChange: (v: Tiebreaker[]) => void; say: (msg: string) => void }) {
  const err = useFieldError('rules.tiebreakers')
  const missing = TIEBREAKERS.filter((t) => !value.includes(t))
  const move = (i: number, d: number) => {
    const j = i + d
    if (j < 0 || j >= value.length) return
    const next = [...value]
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
    say(`${TIEBREAKER_LABELS[value[i]]} is now number ${j + 1} of ${value.length}.`)
  }
  const remove = (i: number) => {
    const t = value[i]
    onChange(value.filter((_, k) => k !== i))
    say(`${TIEBREAKER_LABELS[t]} is no longer used. You can add it back below the list.`)
    focusById(`tb-add-${t}`)
  }
  const add = (t: Tiebreaker) => {
    onChange([...value, t])
    say(`${TIEBREAKER_LABELS[t]} added as number ${value.length + 1}.`)
    focusById(`tb-up-${t}`)
  }
  return (
    <div className="adm-field" id="f-rules.tiebreakers" tabIndex={-1} role="group" aria-labelledby="tb-tie-h" aria-describedby="tb-tie-hint">
      <span className="lbl" id="tb-tie-h">Tiebreak order</span>
      <p className="hint" id="tb-tie-hint">When teams finish on the same record, these decide the standings, first to last.</p>
      <ol style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 6 }}>
        {value.map((t, i) => {
          const label = TIEBREAKER_LABELS[t]
          return (
            <li key={t} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px 4px 14px', border: '1px solid rgb(var(--ink-dark-rgb) / .12)', borderRadius: 10, background: 'var(--paper-card)' }}>
              <span style={{ flex: 1, minWidth: 0, fontWeight: 600 }}>{i + 1}. {label}</span>
              <button id={`tb-up-${t}`} type="button" className="adm-btn icon small" aria-disabled={i === 0} aria-label={`Move ${label} up`} onClick={() => move(i, -1)}>↑</button>
              <button type="button" className="adm-btn icon small" aria-disabled={i === value.length - 1} aria-label={`Move ${label} down`} onClick={() => move(i, 1)}>↓</button>
              {value.length > 1 && (
                <button type="button" className="adm-btn icon small danger" aria-label={`Stop using ${label}`} onClick={() => remove(i)}>✕</button>
              )}
            </li>
          )
        })}
      </ol>
      {missing.length > 0 && (
        <div className="adm-actions">
          {missing.map((t) => (
            <button key={t} id={`tb-add-${t}`} type="button" className="adm-btn small" onClick={() => add(t)}>+ {TIEBREAKER_LABELS[t]}</button>
          ))}
        </div>
      )}
      {err && <p className="err">{err}</p>}
    </div>
  )
}

/**
 * Collapsible rows with move up/down and remove, styled like the kit's ListEditor. Its own copy
 * because ListEditor's remove message talks about drafts and publishing, which tournaments don't
 * have (a save is live), and its rows close again once an error is fixed.
 */
function Rows<T>({ items, onChange, keyOf, path, errors, title, summary, render, makeNew, limitNote, addLabel, focusField, noun, removeNote, say }: {
  items: T[]
  onChange: (items: T[]) => void
  keyOf: (item: T) => string
  path: string
  errors: Errors
  title: (item: T) => string
  summary?: (item: T) => string
  render: (item: T, i: number, set: (v: T) => void) => React.ReactNode
  makeNew?: () => T
  limitNote: string
  addLabel: string
  /** the field focused in a newly added row */
  focusField: string
  noun: string
  removeNote: string
  say: (msg: string) => void
}) {
  const addRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set(items.length === 1 ? items.map(keyOf) : []))
  // rows with a server error open, and stay open while they are fixed
  const [seenErrors, setSeenErrors] = useState(errors)
  if (errors !== seenErrors) {
    setSeenErrors(errors)
    const bad = items.filter((_, i) => hasErrorAt(errors, path, i)).map(keyOf)
    if (bad.some((k) => !open.has(k))) setOpen(new Set([...open, ...bad]))
  }
  const listError = errors[path]

  const toggle = (k: string) => setOpen((s) => {
    const next = new Set(s)
    if (!next.delete(k)) next.add(k)
    return next
  })
  const move = (i: number, d: number) => {
    const j = i + d
    if (j < 0 || j >= items.length) return
    const next = [...items]
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
    say(`${title(items[i])} moved to position ${j + 1} of ${items.length}.`)
  }
  const remove = (i: number) => {
    const name = title(items[i])
    if (!window.confirm(`Remove “${name}”? ${removeNote}`)) return
    onChange(items.filter((_, k) => k !== i))
    say(`${name} removed. Save to keep the change.`)
    // the row's buttons are gone: land on the row that took its place, or the add button
    focusById(`f-${path}.${Math.min(i, items.length - 2)}`, addRef.current)
  }
  const add = () => {
    if (!makeNew) return
    const item = makeNew()
    onChange([...items, item])
    setOpen((s) => new Set(s).add(keyOf(item)))
    say(`New ${noun} added.`)
    focusById(`f-${path}.${items.length}.${focusField}`)
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {listError && <p className="err" role="alert" style={{ color: 'var(--danger-on-light)', fontWeight: 600 }}>{listError}</p>}
      {items.length > 0 && (
        <ul className="adm-list">
          {items.map((item, i) => {
            const k = keyOf(item)
            const isOpen = open.has(k)
            const bad = hasErrorAt(errors, path, i)
            const name = title(item)
            const bodyId = `${path}-${k}-body`
            return (
              <li key={k} className="adm-item" data-open={isOpen}>
                <header>
                  <button id={`f-${path}.${i}`} type="button" className="title" aria-expanded={isOpen} aria-controls={bodyId} onClick={() => toggle(k)}>
                    <span aria-hidden="true">{isOpen ? '▾' : '▸'}</span>
                    <span style={{ display: 'grid', minWidth: 0 }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
                      {summary && <span className="adm-muted" style={{ fontWeight: 400, overflow: 'hidden', textOverflow: 'ellipsis' }}>{summary(item)}</span>}
                    </span>
                    {bad && <span className="adm-badge bad">Needs a fix</span>}
                  </button>
                  <button type="button" className="adm-btn icon small" aria-disabled={i === 0} aria-label={`Move ${name} up`} onClick={() => move(i, -1)}>↑</button>
                  <button type="button" className="adm-btn icon small" aria-disabled={i === items.length - 1} aria-label={`Move ${name} down`} onClick={() => move(i, 1)}>↓</button>
                  <button type="button" className="adm-btn icon small danger" aria-label={`Remove ${name}`} onClick={() => remove(i)}>✕</button>
                </header>
                <div id={bodyId} className="body" hidden={!isOpen} style={isOpen ? undefined : { display: 'none' }}>
                  {render(item, i, (v) => onChange(items.map((x, n) => (n === i ? v : x))))}
                </div>
              </li>
            )
          })}
        </ul>
      )}
      {makeNew ? (
        <div><button ref={addRef} type="button" className="adm-btn" onClick={add}>+ {addLabel}</button></div>
      ) : (
        <p className="adm-muted">{limitNote}</p>
      )}
    </div>
  )
}
