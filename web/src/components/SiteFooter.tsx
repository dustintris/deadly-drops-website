import Link from 'next/link'
import type { Club } from '@/lib/types'
import { asset } from '@/lib/utils'
import { MotionToggle } from './MotionToggle'
import { NewsletterForm } from './NewsletterForm'
import styles from './shell.module.css'

// same order as the header menu: Tournaments · Charity · Shop · Community · Gallery · About us · Contact us
const COLS = [
  { title: 'Play', links: [['Tournaments', '/tournaments/'], ['Charity', '/charity/'], ['Register', '/tournaments/#register'], ['Ladder', '/tournaments/#ladder']] },
  { title: 'Club', links: [['Shop', '/shop/'], ['Community', '/community/'], ['Gallery', '/gallery/'], ['Members', '/members/']] },
  { title: 'More', links: [['About us', '/about/'], ['Contact us', '/contact/'], ['My play', '/me/']] },
]

/** `logo` is the club logo from Admin → Logo & colours (the bundled badge until one is uploaded). */
export function SiteFooter({ club, logo, motionPaused }: { club: Club; logo: { src: string; alt: string }; motionPaused: boolean }) {
  return (
    <footer className={styles.footer}>
      <div className={`wrap ${styles.footerGrid}`}>
        <div className={styles.footerBrand}>
          <img src={asset(logo.src)} alt={logo.alt} width={64} height={64} />
          <p>
            {club.city} {club.postcode}
            <br />
            <a href={`mailto:${club.email}`}>{club.email}</a>
            {club.phone && (<><br /><a href={club.phoneHref}>{club.phone}</a></>)}
          </p>
        </div>
        {COLS.map((c) => (
          <div key={c.title}>
            <p className="eyebrow">{c.title}</p>
            <ul className={styles.footerLinks}>
              {c.links.map(([label, href]) => (
                <li key={href}><Link href={href}>{label}</Link></li>
              ))}
            </ul>
          </div>
        ))}
        <div className={styles.footerJoin}>
          <p className="eyebrow">Join the list</p>
          <NewsletterForm />
        </div>
      </div>
      <div className={`wrap ${styles.footerFine}`}>
        <span>© {new Date().getFullYear()} {club.name}</span>
        <span>Tournament photography: Clara Barra and Bert Temple.</span>
        <MotionToggle paused={motionPaused} />
      </div>
    </footer>
  )
}
