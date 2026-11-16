import Link from 'next/link'
import type { LiveMatch, LiveTeam } from '@/lib/data'
import l from './live.module.css'
import styles from './widgets.module.css'

const playerLine = (players: string[]) => players.join(players.length === 2 ? ' & ' : ', ')

function Side({ team, score, lead, compact }: { team: LiveTeam; score: number; lead: boolean; compact?: boolean }) {
  const players = playerLine(team.players)
  return (
    <div className={styles.scoreRow} data-lead={lead}>
      <span className={l.cardTeam}>
        {team.name}
        {!compact && players && players !== team.name && <small>{players}</small>}
      </span>
      <strong><span className="sr">: </span>{score}</strong>
    </div>
  )
}

/**
 * A match being played right now at the lead tournament (home page). The page follows the
 * tournament's live channel (LiveRefresh), so the score moves within a second of being entered.
 */
export function LiveScore({ match, compact }: { match: LiveMatch; compact?: boolean }) {
  const { teamA, teamB, scoreA, scoreB } = match
  const court = match.court !== null ? `Court ${match.court}` : null
  return (
    <section className={`${styles.score} ${compact ? styles.scoreCompact : ''}`} aria-label={`Live score${court ? ` on ${court}` : ''}, ${match.division}`}>
      <header>
        <span className="eyebrow"><span className="live-dot" aria-hidden="true" /> Live{court ? ` · ${court}` : ''}</span>
        <span className={styles.scoreDiv}>{match.division}</span>
      </header>
      <Side team={teamA} score={scoreA} lead={scoreA > scoreB} compact={compact} />
      <Side team={teamB} score={scoreB} lead={scoreB > scoreA} compact={compact} />
      <footer className={l.cardFoot}>
        <span>Game to {match.gamesTo}</span>
        <Link href={`/tournaments/${match.slug}/#results`} className="link-arrow">
          All scores →<span className="sr"> for {match.tournamentName}</span>
        </Link>
      </footer>
    </section>
  )
}
