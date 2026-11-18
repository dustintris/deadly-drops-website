import { asset } from '@/lib/utils'
import styles from './page.module.css'
import { CloudEdge, Sparkles } from './Sky'

type Props = {
  eyebrow?: string
  title: React.ReactNode
  lede?: React.ReactNode
  photo?: string
  photoPosition?: string
  aside?: React.ReactNode
  children?: React.ReactNode
}

/**
 * The photo a hero falls back to: the DOMINATE podium. It's nearly square and the faces are in its top
 * quarter, so a wide hero frames it from near the top (centred, the heads were cut off).
 */
export const DEFAULT_HERO_PHOTO = { src: '/images/club/dominate-podium-1.jpg', position: '50% 10%' }

/** Page opener used by inner pages: photo or twilight sky, sparkles, eyebrow, display title, optional side panel, cloud edge. */
export function PageHero({ eyebrow, title, lede, photo, photoPosition = '50% 40%', aside, children }: Props) {
  return (
    <section className={`${styles.hero} ${photo ? styles.withPhoto : ''}`}>
      {/* the slow zoom grows from the photo's focal point, so it never pushes the faces out of frame */}
      {photo && <img className={styles.heroImg} src={asset(photo)} alt="" style={{ objectPosition: photoPosition, transformOrigin: photoPosition }} />}
      <Sparkles />
      <div className={`wrap ${styles.heroInner}`}>
        <div className={styles.heroCopy} data-enter>
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h1 className="display d-l">{title}</h1>
          {lede && <p className="lede">{lede}</p>}
          {children}
        </div>
        {aside && <div className={styles.heroAside}>{aside}</div>}
      </div>
      <CloudEdge />
    </section>
  )
}
