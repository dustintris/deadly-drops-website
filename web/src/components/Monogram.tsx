import type { Member } from '@/lib/types'
import styles from './Monogram.module.css'

const TONES = 6

/** Designed initials tile used until real member portraits exist. Fills its parent; initials scale with the tile. */
export function Monogram({ member, size = 'md', round = false }: { member: Pick<Member, 'initials' | 'tone' | 'name'>; size?: 'sm' | 'md' | 'xl'; round?: boolean }) {
  return (
    <span className={`${styles.tile} ${styles[size]} ${round ? styles.round : ''}`} data-tone={member.tone % TONES} aria-hidden="true">
      <span>{member.initials}</span>
    </span>
  )
}
