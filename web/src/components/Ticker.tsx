import styles from './widgets.module.css'

/** Scrolling news band. Items are listed twice so the loop is seamless; the copy is hidden from screen readers. */
export function Ticker({ items }: { items: string[] }) {
  const row = items.flatMap((t, i) => [
    <span key={`t${i}`}>{t}</span>,
    <span key={`s${i}`} className={styles.tickSep} aria-hidden="true">✦</span>,
  ])
  return (
    <div className={styles.ticker}>
      <p className="sr">{items.join('. ')}</p>
      <div className={styles.tickTrack} aria-hidden="true">
        <div>{row}</div>
        <div>{row}</div>
      </div>
    </div>
  )
}
