import { asset } from '@/lib/utils'
import styles from './page.module.css'

type Props = {
  eyebrow?: string
  title: React.ReactNode
  lede?: React.ReactNode
  photo?: string
  photoPosition?: string
  aside?: React.ReactNode
  children?: React.ReactNode
}

/** Page opener used by inner pages: photo or tinted ground, eyebrow, display title, optional side panel. */
export function PageHero({ eyebrow, title, lede, photo, photoPosition = '50% 40%', aside, children }: Props) {
  return (
    <section className={`${styles.hero} ${photo ? styles.withPhoto : ''}`}>
      {photo && <img className={styles.heroImg} src={asset(photo)} alt="" style={{ objectPosition: photoPosition }} />}
      <div className={`wrap ${styles.heroInner}`}>
        <div className={styles.heroCopy} data-enter>
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h1 className="display d-l">{title}</h1>
          {lede && <p className="lede">{lede}</p>}
          {children}
        </div>
        {aside && <div className={styles.heroAside}>{aside}</div>}
      </div>
    </section>
  )
}
