'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { audit } from '@/lib/audit'
import { can } from '@/lib/auth/permissions'
import { getSession, type Session } from '@/lib/auth/session'
import { text } from '@/lib/content-schema'
import {
  createTournament,
  deleteTournament,
  DivisionInUseError,
  PlayoffsDrawnError,
  saveTournament,
  SlugTakenError,
  StaleTournamentError,
  TournamentNotFoundError,
  type Tournament,
} from '@/lib/tournaments/repo'
import { MainCourtLink, TournamentInput } from '@/lib/tournaments/schema'

/**
 * Tournament create / save / delete. Needs `tournaments: edit`, checked here on the server.
 * Saves are live at once (a hidden tournament is the draft), so every save refreshes the site.
 */

export type TournamentResult = { ok: boolean; message: string; errors?: Record<string, string>; tournament?: Tournament }

const Id = z.number().int().positive()
const Version = z.number().int().positive()
const Name = text(3, 80, 'Tournament name')

async function editor(): Promise<Session | TournamentResult> {
  const s = await getSession()
  if (!s) return { ok: false, message: 'Your session ended. Sign in again.' }
  if (!can(s, 'tournaments', 'edit')) return { ok: false, message: 'Your login can view tournaments but not change them.' }
  return s
}
const refused = (x: Session | TournamentResult): x is TournamentResult => 'ok' in x

function fieldErrors(issues: z.ZodIssue[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const i of issues) out[i.path.join('.') || '_'] ??= i.message
  return out
}

function failure(e: unknown, fallback: string): TournamentResult {
  if (e instanceof StaleTournamentError || e instanceof SlugTakenError) {
    return { ok: false, message: e.message, errors: e instanceof SlugTakenError ? { slug: e.message } : undefined }
  }
  if (e instanceof TournamentNotFoundError || e instanceof DivisionInUseError || e instanceof PlayoffsDrawnError) return { ok: false, message: e.message }
  console.error(e)
  return { ok: false, message: fallback }
}

const refresh = () => {
  revalidatePath('/', 'layout') // public pages and the admin list
}

/** Start a new hidden tournament; the editor opens on it. */
/** Create a hidden tournament from its name and, optionally, its Main Court link (where players register). */
export async function createTournamentAction(name: unknown, registrationUrl: unknown = ''): Promise<TournamentResult> {
  const s = await editor()
  if (refused(s)) return s
  const parsed = Name.safeParse(name)
  const link = MainCourtLink.safeParse(registrationUrl)
  if (!parsed.success || !link.success) {
    const errors: Record<string, string> = {}
    if (!parsed.success) errors.name = parsed.error.issues[0].message
    if (!link.success) errors.registrationUrl = link.error.issues[0].message
    return { ok: false, message: 'Fix the highlighted field.', errors }
  }
  try {
    const t = await createTournament(parsed.data, { registrationUrl: link.data })
    await audit(s.email, 'tournament_create', t.name)
    refresh()
    return { ok: true, message: `${t.name} created. It stays hidden until you tick “Show on the website”.`, tournament: t }
  } catch (e) {
    return failure(e, 'Creating the tournament failed on the server. Try again.')
  }
}

/** Save the whole tournament (info, days, rules, divisions) if nobody saved it since `version`. */
export async function saveTournamentAction(id: unknown, input: unknown, version: unknown): Promise<TournamentResult> {
  const s = await editor()
  if (refused(s)) return s
  const tid = Id.safeParse(id)
  const ver = Version.safeParse(version)
  if (!tid.success || !ver.success) return { ok: false, message: 'Reload the page and try again.' }
  const parsed = TournamentInput.safeParse(input)
  if (!parsed.success) {
    const errors = fieldErrors(parsed.error.issues)
    const n = Object.keys(errors).length
    return { ok: false, message: `Fix ${n === 1 ? 'the highlighted field' : `${n} fields`} and save again.`, errors }
  }
  try {
    const t = await saveTournament(tid.data, parsed.data, ver.data)
    await audit(s.email, 'tournament_save', t.name)
    refresh()
    return { ok: true, message: t.visible ? 'Saved. The website shows it now.' : 'Saved. It’s hidden from the website until you tick “Show on the website”.', tournament: t }
  } catch (e) {
    return failure(e, 'Saving failed on the server. Try again.')
  }
}

export async function deleteTournamentAction(id: unknown): Promise<TournamentResult> {
  const s = await editor()
  if (refused(s)) return s
  const tid = Id.safeParse(id)
  if (!tid.success) return { ok: false, message: 'Unknown tournament.' }
  try {
    await deleteTournament(tid.data)
    await audit(s.email, 'tournament_delete', String(tid.data))
    refresh()
    return { ok: true, message: 'Tournament deleted.' }
  } catch (e) {
    return failure(e, 'Deleting failed on the server. Try again.')
  }
}
