export interface PlayerInfo {
  name: string
  dupr: string
}

/**
 * Teams pasted straight from a spreadsheet (Google Sheets copies cells as
 * tab-separated lines). Two layouts are recognised because both exist in the
 * club's sheets:
 *
 *   one team per row:    [team name]  player 1  [DUPR]  player 2  [DUPR]
 *   one player per row:  [1a]  [team name]  player  [DUPR]   (rows pair up)
 *
 * A cell that looks like a rating (2.863, 4.1, NR) is a DUPR, "1a"/"1b" are
 * the sheet's team tags, header rows are skipped, and "A / B" or "A & B" in
 * one cell counts as two players. Anything else with digits in it (a division
 * label, a phone number, a fee) is not a name and is ignored.
 */
export interface PastedTeam {
  name: string
  players: [PlayerInfo, PlayerInfo]
}

export interface PasteResult {
  teams: PastedTeam[]
  /** A player left without a partner on the last line, if any. */
  unpaired: string | null
}

const RATING = /^(nr|\d(\.\d{1,3})?)$/i
const TAG = /^\d{1,2}\s*[ab]$/i
const HEADER = /^(team|team ?name|name|names|player|player ?[12]|partner|dupr|rating|#|no\.?)$/i
const SHIRT_SIZE = /^(xs|s|m|l|xl|xxl|3xl)$/i

interface Row {
  tag: string | null
  names: string[]
  ratings: string[]
}

function parseRow(cells: string[]): Row | null {
  const row: Row = { tag: null, names: [], ratings: [] }
  for (const cell of cells) {
    if (!cell) continue
    if (TAG.test(cell)) {
      row.tag = cell
      continue
    }
    if (RATING.test(cell)) {
      row.ratings.push(cell.toUpperCase() === 'NR' ? 'NR' : cell)
      continue
    }
    if (/[\d@]/.test(cell) || SHIRT_SIZE.test(cell)) continue
    for (const part of cell.split(/\s*(?:\/|&|\band\b)\s*/i)) {
      if (part.trim()) row.names.push(part.trim())
    }
  }
  if (row.names.length === 0) return null
  if (row.names.every((n) => HEADER.test(n))) return null
  return row
}

export function parsePastedTeams(text: string): PasteResult {
  const separator = text.includes('\t') ? '\t' : ','
  const teams: PastedTeam[] = []
  let pending: { name: string; player: PlayerInfo } | null = null

  for (const line of text.split(/\r?\n/)) {
    const row = parseRow(line.split(separator).map((c) => c.trim()))
    if (!row) continue
    // A tagged row is always one player; so is a row with a single name.
    if (row.tag !== null || row.names.length === 1) {
      const player = { name: row.names[row.names.length - 1], dupr: row.ratings[0] ?? '' }
      const teamName = row.names.length > 1 ? row.names.slice(0, -1).join(' ') : ''
      if (pending) {
        teams.push({ name: pending.name || teamName, players: [pending.player, player] })
        pending = null
      } else {
        pending = { name: teamName, player }
      }
      continue
    }
    // Two or more names on one row: the last two are the players, anything
    // before them is the team name.
    const [a, b] = row.names.slice(-2)
    teams.push({
      name: row.names.slice(0, -2).join(' '),
      players: [
        { name: a, dupr: row.ratings[0] ?? '' },
        { name: b, dupr: row.ratings[1] ?? '' },
      ],
    })
  }
  return { teams, unpaired: pending?.player.name ?? null }
}

/** Just the teams; use parsePastedTeams when the unpaired leftover matters. */
export function parseTeams(text: string): { name: string; players: PlayerInfo[] }[] {
  return parsePastedTeams(text).teams
}
