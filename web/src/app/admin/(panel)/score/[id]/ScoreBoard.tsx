'use client'

/**
 * Phone-first scoring for one tournament: pick the day and division, then matches are grouped into
 * Live / Up next / Finished, each by time slot and court. Tapping a match opens the ScorePad
 * (scorekeepers only). <LiveRefresh> on the page re-renders this with other people's saves; a
 * save made here shows at once. Scores typed but not saved are kept as drafts on this device.
 */
import { useEffect, useRef, useState } from 'react'
import { ScorePad, STATUS_LABELS, type PadDraft, type PadTeam } from '@/components/admin/ScorePad'
import { formatTime12 } from '@/lib/match/schedule'
import type { Match, Stage } from '@/lib/play/repo'

export type BoardTeam = { id: number; name: string; players: string[] }
export type BoardDivision = { id: number; name: string; dayIndex: number; gamesTo: number; teams: BoardTeam[]; matches: Match[] }

type Props = {
  tournamentId: number
  /** day labels, e.g. "Sat, Nov 8" */
  days: string[]
  /** index of today in `days`, or -1 */
  todayIndex: number
  playoffGamesTo: number
  winBy2: boolean
  divisions: BoardDivision[]
  canEdit: boolean
}

type Card = { m: Match; div: BoardDivision; a: PadTeam | null; b: PadTeam | null; gamesTo: number }
type Drafts = Record<number, PadDraft>

const STAGE_LABELS: Record<Exclude<Stage, 'pool'>, string> = { qf: 'Quarterfinal', sf: 'Semifinal', final: 'Final', bronze: 'Bronze match' }
const NEXT_SLOTS = 3
const stageLabel = (m: Match) => (m.stage === 'pool' ? `Round ${m.round}` : STAGE_LABELS[m.stage])
const timeLabel = (m: Match) => (m.startsAt ? formatTime12(m.startsAt) : stageLabel(m))
const courtLabel = (m: Match) => (m.court !== null ? `Court ${m.court}` : 'Court TBD')
const score = (n: number | null) => (n === null ? '–' : String(n))

/** Time slots in order (latest first for finished games), each with its matches by court. */
function bySlot(cards: Card[], latestFirst = false) {
  const groups = new Map<string, Card[]>()
  for (const c of cards) {
    const key = c.m.startsAt ?? `~${c.m.stage}${String(c.m.round).padStart(3, '0')}`
    const list = groups.get(key)
    if (list) list.push(c)
    else groups.set(key, [c])
  }
  const keys = [...groups.keys()].sort()
  if (latestFirst) keys.reverse()
  return keys.map((key) => {
    const list = groups.get(key)!.sort((x, y) => (x.m.court ?? 999) - (y.m.court ?? 999) || x.div.name.localeCompare(y.div.name) || x.m.id - y.m.id)
    return { key, label: timeLabel(list[0].m), cards: list }
  })
}

function readDrafts(key: string): Drafts {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(key) ?? '{}')
    const out: Drafts = {}
    if (raw && typeof raw === 'object') {
      for (const [id, d] of Object.entries(raw as Record<string, Partial<PadDraft>>)) {
        if (Number.isInteger(d?.a) && Number.isInteger(d?.b) && Number.isInteger(d?.version)) out[Number(id)] = { a: d.a!, b: d.b!, version: d.version! }
      }
    }
    return out
  } catch {
    return {}
  }
}

const without = (drafts: Drafts, id: number): Drafts => {
  const next = { ...drafts }
  delete next[id]
  return next
}

function writeDrafts(key: string, drafts: Drafts) {
  try {
    if (Object.keys(drafts).length) localStorage.setItem(key, JSON.stringify(drafts))
    else localStorage.removeItem(key)
  } catch {
    /* private mode or storage full: the drafts still live on this screen */
  }
}

export function ScoreBoard({ tournamentId, days, todayIndex, playoffGamesTo, winBy2, divisions, canEdit }: Props) {
  const multiDay = days.length > 1
  const [day, setDay] = useState(() => {
    if (todayIndex >= 0) return todayIndex
    const open = divisions.find((d) => d.matches.some((m) => m.status !== 'final'))
    return open?.dayIndex ?? 0
  })
  const [divId, setDivId] = useState<number | 'all'>('all')
  const [openId, setOpenId] = useState<number | null>(null)
  /** the card the pad opened with: a live refresh that drops the match (schedule cleared) must not unmount the pad and lose a typed score */
  const [pinned, setPinned] = useState<Card | null>(null)
  const [overrides, setOverrides] = useState<Record<number, Match>>({})
  const [drafts, setDrafts] = useState<Drafts>({})
  const [announce, setAnnounce] = useState('')
  const [allNext, setAllNext] = useState(false)
  const [showFinished, setShowFinished] = useState(false)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const storeKey = `ddp-score-drafts-${tournamentId}`

  // unsaved scores from an earlier visit (the page was reloaded or the phone closed the tab)
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    const saved = readDrafts(storeKey)
    if (Object.keys(saved).length) setDrafts((prev) => ({ ...saved, ...prev }))
    setLoaded(true)
  }, [storeKey])
  useEffect(() => {
    if (loaded) writeDrafts(storeKey, drafts)
  }, [loaded, drafts, storeKey])
  // the same text twice is not read out again, so nudge it
  const say = (msg: string) => setAnnounce((prev) => (prev === msg ? `${msg} ` : msg))

  const onDay = multiDay ? divisions.filter((d) => d.dayIndex === day) : divisions
  const shown = divId === 'all' ? onDay : onDay.filter((d) => d.id === divId)

  const cards: Card[] = shown.flatMap((div) => {
    const teams = new Map(div.teams.map((t) => [t.id, t]))
    const team = (tid: number | null): PadTeam | null => {
      const t = tid === null ? undefined : teams.get(tid)
      return t ? { name: t.name, players: t.players } : null
    }
    return div.matches.map((raw) => {
      const o = overrides[raw.id]
      const m = o && o.version > raw.version ? o : raw
      return { m, div, a: team(m.teamAId), b: team(m.teamBId), gamesTo: m.stage === 'pool' ? div.gamesTo : playoffGamesTo }
    })
  })
  const live = bySlot(cards.filter((c) => c.m.status === 'live'))
  const next = bySlot(cards.filter((c) => c.m.status === 'scheduled'))
  const finished = bySlot(cards.filter((c) => c.m.status === 'final'), true)
  const count = (g: { cards: Card[] }[]) => g.reduce((n, s) => n + s.cards.length, 0)
  const nextShown = allNext ? next : next.slice(0, NEXT_SLOTS)
  const current = openId === null ? undefined : cards.find((c) => c.m.id === openId)
  const open = current ?? (pinned && pinned.m.id === openId ? pinned : undefined)
  const gone = open !== undefined && current === undefined && !divisions.some((d) => d.matches.some((m) => m.id === openId))
  const openMatch = (id: number) => {
    setPinned(cards.find((c) => c.m.id === id) ?? null)
    setOpenId(id)
  }

  const pickDay = (i: number) => {
    setDay(i)
    if (divId !== 'all' && !divisions.some((d) => d.id === divId && d.dayIndex === i)) setDivId('all')
  }

  const onSaved = (m: Match) => {
    setOverrides((prev) => ({ ...prev, [m.id]: m }))
    // a draft equal to what was saved is done with (one typed after the save went out stays)
    setDrafts((prev) => (prev[m.id]?.a === m.scoreA && prev[m.id]?.b === m.scoreB ? without(prev, m.id) : prev))
    if (m.status === 'final') {
      const c = cards.find((x) => x.m.id === m.id)
      say(`Final saved: ${c?.a?.name ?? 'Team A'} ${m.scoreA ?? 0}, ${c?.b?.name ?? 'Team B'} ${m.scoreB ?? 0}.`)
    }
  }

  /** `id` is the pad's own match: a late close from an earlier pad never clears or files a draft under another match */
  const closePad = (id: number, unsaved: PadDraft | null) => {
    setOpenId((cur) => (cur === id ? null : cur))
    setPinned((p) => (p?.m.id === id ? null : p))
    if (unsaved) {
      setDrafts((prev) => ({ ...prev, [id]: unsaved }))
      say(`Not saved: ${unsaved.a}–${unsaved.b} is kept on this device. Open the match again to save it.`)
    } else {
      setDrafts((prev) => (prev[id] ? without(prev, id) : prev))
    }
    // back to the match that was opened (it may have moved to another section), else the heading
    requestAnimationFrame(() => {
      const el = document.querySelector<HTMLElement>(`[data-match-card="${id}"]`)
      ;(el ?? headingRef.current)?.focus()
    })
  }

  const totalMatches = divisions.reduce((n, d) => n + d.matches.length, 0)

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <section aria-label="Filter matches" className="adm-card" style={{ display: 'grid', gap: 12, padding: 14 }}>
        {multiDay && (
          <div role="group" aria-label="Day" className="adm-actions">
            {days.map((label, i) => (
              <button key={i} type="button" className={`adm-btn ${day === i ? 'primary' : ''}`} style={{ minHeight: 48 }} aria-pressed={day === i} onClick={() => pickDay(i)}>
                {label}{i === todayIndex ? ' (today)' : ''}
              </button>
            ))}
          </div>
        )}
        <div className="adm-field">
          <label htmlFor="score-division">Division</label>
          <select id="score-division" className="adm-input" style={{ minHeight: 48 }} value={divId}
            onChange={(e) => setDivId(e.target.value === 'all' ? 'all' : Number(e.target.value))}>
            <option value="all">{multiDay ? 'All divisions this day' : 'All divisions'}</option>
            {onDay.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
      </section>

      <h2 ref={headingRef} tabIndex={-1} className="sr">Matches</h2>
      <p role="status" className="adm-note good" style={{ minHeight: 0 }}>{announce}</p>

      {totalMatches === 0 ? (
        <p className="adm-muted">No schedule yet. Make one under Tournaments → Teams &amp; schedule.</p>
      ) : cards.length === 0 ? (
        <p className="adm-muted">No matches for this {multiDay ? 'day and ' : ''}division.</p>
      ) : (
        <>
          <Section title="Live" count={count(live)} empty="No game is in progress.">
            {live.map((g) => <Slot key={g.key} label={g.label} cards={g.cards} canEdit={canEdit} drafts={drafts} onOpen={openMatch} />)}
          </Section>

          <Section title="Up next" count={count(next)} empty="Nothing left to play.">
            {nextShown.map((g) => <Slot key={g.key} label={g.label} cards={g.cards} canEdit={canEdit} drafts={drafts} onOpen={openMatch} />)}
            {next.length > NEXT_SLOTS && (
              <button type="button" className="adm-btn" style={{ minHeight: 48 }} aria-expanded={allNext} onClick={() => setAllNext((v) => !v)}>
                {allNext ? 'Show only the next few' : `Show later games (${count(next.slice(NEXT_SLOTS))})`}
              </button>
            )}
          </Section>

          <Section title="Finished" count={count(finished)} empty="No game has finished yet.">
            {finished.length > 0 && (
              <button type="button" className="adm-btn" style={{ minHeight: 48, justifySelf: 'start' }} aria-expanded={showFinished} aria-controls="score-finished"
                onClick={() => setShowFinished((v) => !v)}>
                {showFinished ? 'Hide finished games' : 'Show finished games'}
              </button>
            )}
            <div id="score-finished" hidden={!showFinished} style={{ display: showFinished ? 'grid' : 'none', gap: 14 }}>
              {finished.map((g) => <Slot key={g.key} label={g.label} cards={g.cards} canEdit={canEdit} drafts={drafts} onOpen={openMatch} />)}
            </div>
          </Section>
        </>
      )}

      {canEdit && open && open.a && open.b && (
        <ScorePad
          key={open.m.id}
          match={open.m}
          teamA={open.a}
          teamB={open.b}
          title={`${courtLabel(open.m)} · ${timeLabel(open.m)}`}
          subtitle={`${open.div.name} · ${stageLabel(open.m)}`}
          gamesTo={open.gamesTo}
          winBy2={winBy2}
          draft={drafts[open.m.id]}
          onSaved={onSaved}
          onClose={closePad}
          gone={gone}
        />
      )}
    </div>
  )
}

function Section({ title, count, empty, children }: { title: string; count: number; empty: string; children: React.ReactNode }) {
  const id = `score-${title.toLowerCase().replace(/\W+/g, '-')}`
  return (
    <section aria-labelledby={id} style={{ display: 'grid', gap: 12 }}>
      <h2 id={id} style={{ fontSize: 20 }}>{title} ({count})</h2>
      {count === 0 ? <p className="adm-muted">{empty}</p> : children}
    </section>
  )
}

function Slot({ label, cards, canEdit, drafts, onOpen }: { label: string; cards: Card[]; canEdit: boolean; drafts: Drafts; onOpen: (id: number) => void }) {
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <h3 className="adm-mono" style={{ fontSize: 13, textTransform: 'uppercase', color: 'rgb(var(--ink-dark-rgb) / .7)' }}>{label}</h3>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))', gap: 10 }}>
        {cards.map((c) => <li key={c.m.id}><MatchCard c={c} canEdit={canEdit} draft={drafts[c.m.id]} onOpen={onOpen} /></li>)}
      </ul>
    </div>
  )
}

const CARD: React.CSSProperties = {
  display: 'grid', gap: 8, width: '100%', minHeight: 48, padding: '12px 14px', textAlign: 'left', font: 'inherit', color: 'inherit',
  background: 'var(--paper-card)', border: '1px solid rgb(var(--ink-dark-rgb) / .14)', borderRadius: 12,
}

function MatchCard({ c, canEdit, draft, onOpen }: { c: Card; canEdit: boolean; draft?: PadDraft; onOpen: (id: number) => void }) {
  const { m } = c
  const nameA = c.a?.name ?? 'To be decided'
  const nameB = c.b?.name ?? 'To be decided'
  const winA = m.status === 'final' && (m.scoreA ?? 0) > (m.scoreB ?? 0)
  const winB = m.status === 'final' && (m.scoreB ?? 0) > (m.scoreA ?? 0)
  const style: React.CSSProperties = { ...CARD, ...(m.status === 'live' ? { borderLeft: '5px solid var(--accent)' } : null) }
  const body = (
    <>
      <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <strong>{courtLabel(m)}</strong>
        <span className="adm-muted" style={{ flex: 1, minWidth: 0 }}>{timeLabel(m)} · {c.div.name} · {stageLabel(m)}</span>
        <span className={`adm-badge ${m.status === 'live' ? 'on' : m.status === 'scheduled' ? 'off' : ''}`}>{STATUS_LABELS[m.status]}</span>
      </span>
      <TeamLine name={nameA} players={c.a?.players ?? []} score={score(m.scoreA)} won={winA} />
      <TeamLine name={nameB} players={c.b?.players ?? []} score={score(m.scoreB)} won={winB} />
      {draft && <span className="adm-note bad">Not saved on this device: {draft.a}–{draft.b}</span>}
    </>
  )
  if (!canEdit || !c.a || !c.b) return <div style={style}>{body}</div>
  const label = `${courtLabel(m)}, ${timeLabel(m)}: ${nameA} ${score(m.scoreA)}, ${nameB} ${score(m.scoreB)}, ${STATUS_LABELS[m.status]}.${draft ? ` Not saved: ${draft.a}–${draft.b}.` : ''} Enter score`
  return (
    <button type="button" data-match-card={m.id} style={{ ...style, cursor: 'pointer' }} aria-label={label} aria-haspopup="dialog" onClick={() => onOpen(m.id)}>
      {body}
    </button>
  )
}

function TeamLine({ name, players, score: value, won }: { name: string; players: string[]; score: string; won: boolean }) {
  return (
    <span style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', alignItems: 'center', gap: 10 }}>
      <span style={{ display: 'grid', minWidth: 0 }}>
        <span style={{ fontWeight: won ? 800 : 600, overflowWrap: 'anywhere' }}>{name}</span>
        {players.length > 0 && <span className="adm-muted" style={{ fontSize: 13, overflowWrap: 'anywhere' }}>{players.join(' & ')}</span>}
      </span>
      <span style={{ fontSize: 28, fontWeight: won ? 800 : 600, fontVariantNumeric: 'tabular-nums', minWidth: '2ch', textAlign: 'right' }}>{value}</span>
    </span>
  )
}
