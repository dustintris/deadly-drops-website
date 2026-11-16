'use client'

/**
 * The phone score pad for one match: big −/+ per team (the numbers can be typed too), Save (game
 * live) and Finish game (final). Every save carries the match version this pad last saw; the
 * server answers with the saved match, or with the current one when someone else saved first.
 * A typed score is never thrown away: a failed or refused save keeps it on screen, and closing the
 * pad hands any unsaved score back to the board (which keeps it as a draft).
 */
import { useEffect, useId, useRef, useState } from 'react'
import { saveScoreAction, type PlayResult } from '@/app/admin/play-actions'
import { isGameComplete } from '@/lib/match/scoring'
import type { Match, MatchStatus } from '@/lib/play/repo'

export type PadTeam = { name: string; players: string[] }
/** A score typed on this device but not saved yet, with the match version it was typed against. */
export type PadDraft = { a: number; b: number; version: number }

type Want = { status: MatchStatus; force: boolean }
type Phase =
  | { kind: 'idle'; text: string }
  | { kind: 'saving'; want: Want }
  | { kind: 'error'; text: string }
  | { kind: 'unfinished'; text: string }
  | { kind: 'stale'; current: Match; want: Want }
  | { kind: 'offline'; want: Want }

const MAX = 99
const clamp = (n: number) => Math.max(0, Math.min(MAX, n))
const toNum = (s: string) => {
  const n = parseInt(s, 10)
  return Number.isNaN(n) ? 0 : clamp(n)
}
export const STATUS_LABELS: Record<MatchStatus, string> = { scheduled: 'Not started', live: 'Live', final: 'Final' }
const clock = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-US', { timeZone: 'America/Los_Angeles', hour: 'numeric', minute: '2-digit' })

const BIG: React.CSSProperties = { minWidth: 64, minHeight: 64, fontSize: 32, lineHeight: 1, padding: 0, borderRadius: 12 }
const PANEL: React.CSSProperties = { display: 'grid', gap: 10, padding: 12, borderRadius: 10, background: 'rgb(var(--ink-dark-rgb) / .05)' }
const ACTIONS: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }
const TALL: React.CSSProperties = { minHeight: 52, fontSize: 16 }

type Props = {
  match: Match
  teamA: PadTeam
  teamB: PadTeam
  /** e.g. "Court 3 · 9:20 AM" */
  title: string
  /** e.g. "Men’s 3.5 · Round 2" */
  subtitle: string
  gamesTo: number
  winBy2: boolean
  draft?: PadDraft
  /** a save went through (the board shows it straight away) */
  onSaved: (m: Match) => void
  /** the pad closes; `unsaved` is a typed score that isn't saved yet (keyed by this pad's match, never the board's current one) */
  onClose: (matchId: number, unsaved: PadDraft | null) => void
  /** the match left the schedule while the pad was open (it was cleared or redone): keep the score on screen, block saving */
  gone?: boolean
}

export function ScorePad({ match, teamA, teamB, title, subtitle, gamesTo, winBy2, draft, onSaved, onClose, gone = false }: Props) {
  const id = useId()
  const dialogRef = useRef<HTMLDialogElement>(null)
  /** the newest saved state of this match that the pad knows of */
  const [server, setServer] = useState(match)
  /** the version the next save is based on (older than `server` when someone saved after we started typing) */
  const [ver, setVer] = useState(draft?.version ?? match.version)
  const [a, setA] = useState(String(draft?.a ?? match.scoreA ?? 0))
  const [b, setB] = useState(String(draft?.b ?? match.scoreB ?? 0))
  const [phase, setPhase] = useState<Phase>({ kind: 'idle', text: '' })

  const scoreA = toNum(a)
  const scoreB = toNum(b)
  const touched = scoreA !== (server.scoreA ?? 0) || scoreB !== (server.scoreB ?? 0)
  const busy = phase.kind === 'saving'

  // a newer save from someone else arrived (live refresh): take it unless a score is being typed here
  const [seen, setSeen] = useState(match.version)
  if (match.version !== seen) {
    setSeen(match.version)
    if (match.version > server.version) {
      setServer(match)
      if (!touched && !busy) {
        setVer(match.version)
        setA(String(match.scoreA ?? 0))
        setB(String(match.scoreB ?? 0))
      }
    }
  }

  useEffect(() => {
    const d = dialogRef.current
    if (d && !d.open) d.showModal()
    return () => d?.close()
  }, [])

  const close = () => onClose(match.id, touched ? { a: scoreA, b: scoreB, version: ver } : null)

  const send = async (want: Want, version = ver) => {
    if (busy || gone) return
    const sentA = scoreA
    const sentB = scoreB
    setA(String(sentA))
    setB(String(sentB))
    setPhase({ kind: 'saving', want })
    let res: PlayResult
    try {
      res = await saveScoreAction({ matchId: match.id, scoreA: sentA, scoreB: sentB, status: want.status, version, force: want.force || undefined })
    } catch {
      setPhase({ kind: 'offline', want }) // the entry stays on screen; Retry sends it again
      return
    }
    const done = (m: Match, text: string) => {
      setServer(m)
      setVer(m.version)
      setPhase({ kind: 'idle', text })
      onSaved(m)
      if (m.status === 'final' && want.status === 'final') onClose(match.id, null)
    }
    if (res.ok && res.match) return done(res.match, res.message)
    if (res.match) {
      const cur = res.match
      // the score is already what we sent (an earlier try got through, or someone entered the same)
      if (cur.scoreA === sentA && cur.scoreB === sentB && cur.status === want.status) return done(cur, 'Saved.')
      if (cur.version > server.version) setServer(cur)
      setPhase({ kind: 'stale', current: cur, want })
      return
    }
    const unfinished = want.status === 'final' && !want.force && sentA !== sentB && !isGameComplete(sentA, sentB, gamesTo, winBy2) && /finish/i.test(res.message)
    setPhase(unfinished ? { kind: 'unfinished', text: res.message } : { kind: 'error', text: res.message })
  }

  /** drop the typed score and take the saved one (theirs after a conflict, or Undo) */
  const keepTheirs = (given: Match, text = 'Kept the current score') => {
    const cur = given.version >= server.version ? given : server // a live refresh may already have brought a newer one
    setServer(cur)
    setVer(cur.version)
    setA(String(cur.scoreA ?? 0))
    setB(String(cur.scoreB ?? 0))
    setPhase({ kind: 'idle', text: `${text}, ${cur.scoreA ?? 0}–${cur.scoreB ?? 0}.` })
  }

  const isFinal = server.status === 'final'
  const primary: Want = { status: isFinal ? 'final' : 'live', force: false }
  const secondary: Want = { status: isFinal ? 'live' : 'final', force: false }

  const statusText =
    phase.kind === 'saving' ? 'Saving…'
      : phase.kind === 'idle' ? (touched ? `Not saved yet: ${scoreA}–${scoreB}.` : phase.text)
      : phase.kind === 'offline' ? `Couldn’t reach the server. Your score ${scoreA}–${scoreB} is kept here: check the connection and tap Retry.`
      : phase.kind === 'stale' ? 'Someone else updated this.'
      : phase.text
  const statusClass = phase.kind === 'idle' ? (touched ? '' : 'good') : phase.kind === 'saving' ? '' : 'bad'

  return (
    <dialog ref={dialogRef} className="adm-dialog" aria-labelledby={`${id}-h`} aria-describedby={`${id}-sub`}
      onCancel={(e) => { e.preventDefault(); close() }}
      style={{ width: 'min(520px, calc(100vw - 12px))', maxHeight: 'calc(100svh - 12px)' }}>
      <form noValidate onSubmit={(e) => { e.preventDefault(); void send(primary) }} style={{ padding: 16, display: 'grid', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: 2 }}>
            <h2 id={`${id}-h`} style={{ fontSize: 20 }}>{title}</h2>
            <p id={`${id}-sub`} className="adm-muted">
              {subtitle} · Games to {gamesTo}{winBy2 ? ', win by 2' : ''} · {STATUS_LABELS[server.status]}
            </p>
            {server.updatedBy && server.status !== 'scheduled' && (
              <p className="adm-muted" style={{ fontSize: 13, overflowWrap: 'anywhere' }}>Last saved {clock(server.updatedAt)} by {server.updatedBy}</p>
            )}
          </div>
          <button type="button" className="adm-btn" style={{ minHeight: 48, minWidth: 64 }} onClick={close}>Close</button>
        </div>

        {gone && (
          <p className="adm-locknote" role="alert">
            This match was removed from the schedule, so it can’t be saved. Note the score: {scoreA}–{scoreB}.
          </p>
        )}

        {ver < server.version && phase.kind !== 'stale' && (
          <p className="adm-locknote" role="note">
            Someone else saved {server.scoreA ?? 0}–{server.scoreB ?? 0} since you started. Your score is kept; saving will ask which one to keep.
          </p>
        )}

        <TeamScore side="A" team={teamA} value={a} onChange={setA} />
        <TeamScore side="B" team={teamB} value={b} onChange={setB} />

        {/* one region that stays mounted, so every change is read out */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px 12px', flexWrap: 'wrap' }}>
          <div role="status" className={`adm-note ${statusClass}`} style={{ minHeight: 20, flex: '1 1 200px' }}>
            {statusText}
          </div>
          {touched && !busy && phase.kind !== 'stale' && (
            <button type="button" className="adm-btn small" style={{ minHeight: 44 }} onClick={() => keepTheirs(server, 'Back to the saved score')}>
              Undo: back to {server.scoreA ?? 0}–{server.scoreB ?? 0}
            </button>
          )}
        </div>

        {phase.kind === 'stale' && (
          <div style={PANEL}>
            <p>
              They saved <strong>{phase.current.scoreA ?? 0}–{phase.current.scoreB ?? 0}</strong> ({STATUS_LABELS[phase.current.status]})
              {phase.current.updatedBy ? ` at ${clock(phase.current.updatedAt)} by ${phase.current.updatedBy}` : ''}. Yours is <strong>{scoreA}–{scoreB}</strong>.
            </p>
            <div style={ACTIONS}>
              <button type="button" className="adm-btn primary" style={TALL} onClick={() => { const cur = phase.current; setVer(cur.version); void send(phase.want, cur.version) }}>
                Use mine: {scoreA}–{scoreB}
              </button>
              <button type="button" className="adm-btn" style={TALL} onClick={() => keepTheirs(phase.current)}>
                Keep theirs: {phase.current.scoreA ?? 0}–{phase.current.scoreB ?? 0}
              </button>
            </div>
          </div>
        )}

        {phase.kind === 'unfinished' && (
          <div style={PANEL}>
            <p>If the time ran out, end the game at this score.</p>
            <button type="button" className="adm-btn accent" style={TALL} onClick={() => void send({ status: 'final', force: true })}>
              Time cap: end now at {scoreA}–{scoreB}
            </button>
          </div>
        )}

        {phase.kind === 'offline' && (
          <button type="button" className="adm-btn accent" style={TALL} onClick={() => void send(phase.want)}>Retry</button>
        )}

        {phase.kind !== 'stale' && (
          <div style={ACTIONS}>
            <button type="submit" className="adm-btn primary" style={TALL} aria-disabled={busy || gone}>
              {busy && phase.want.status === primary.status ? 'Saving…' : isFinal ? 'Save correction' : 'Save'}
            </button>
            <button type="button" className={`adm-btn ${isFinal ? '' : 'accent'}`} style={TALL} aria-disabled={busy || gone} onClick={() => void send(secondary)}>
              {busy && phase.want.status === secondary.status ? 'Saving…' : isFinal ? 'Reopen game' : 'Finish game'}
            </button>
          </div>
        )}
      </form>
    </dialog>
  )
}

function TeamScore({ side, team, value, onChange }: { side: 'A' | 'B'; team: PadTeam; value: string; onChange: (fn: (v: string) => string) => void }) {
  const id = useId()
  const step = (d: number) => onChange((v) => String(clamp(toNum(v) + d)))
  return (
    <div style={{ display: 'grid', gap: 8, padding: 12, borderRadius: 12, border: '1px solid rgb(var(--ink-dark-rgb) / .14)' }}>
      <div id={`${id}-team`} style={{ display: 'grid', gap: 2, minWidth: 0 }}>
        <span className="adm-mono" aria-hidden="true" style={{ fontSize: 11, textTransform: 'uppercase', color: 'rgb(var(--ink-dark-rgb) / .6)' }}>Team {side}</span>
        <strong style={{ fontSize: 17, overflowWrap: 'anywhere' }}>{team.name}</strong>
        {team.players.length > 0 && <span className="adm-muted" style={{ overflowWrap: 'anywhere' }}>{team.players.join(' & ')}</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '64px minmax(0, 1fr) 64px', gap: 8, alignItems: 'center' }}>
        <button type="button" className="adm-btn" style={BIG} aria-label={`Team ${side}: take away a point`} aria-describedby={`${id}-team`} onClick={() => step(-1)}>−</button>
        <label htmlFor={id} className="sr">Team {side} score</label>
        <input id={id} className="adm-input" inputMode="numeric" pattern="[0-9]*" autoComplete="off" maxLength={2}
          aria-describedby={`${id}-team`} value={value}
          onChange={(e) => { const v = e.target.value.replace(/\D/g, '').slice(0, 2); onChange(() => v) }}
          onFocus={(e) => e.target.select()}
          onBlur={() => onChange((v) => String(toNum(v)))}
          style={{ minHeight: 64, fontSize: 36, fontWeight: 700, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }} />
        <button type="button" className="adm-btn primary" style={BIG} aria-label={`Team ${side}: add a point`} aria-describedby={`${id}-team`} onClick={() => step(1)}>+</button>
      </div>
    </div>
  )
}
