import Link from 'next/link'
import type { Club } from '@/lib/types'
import { asset } from '@/lib/utils'
import { NewsletterForm } from './NewsletterForm'
import styles from './shell.module.css'

const COLS = [
  { title: 'Club', links: [['About us', '/about/'], ['Community', '/community/'], ['Members', '/members/'], ['My play', '/me/']] },
  { title: 'Play', links: [['Tournaments', '/tournaments/'], ['Register', '/tournaments/#register'], ['Ladder', '/tournaments/#ladder']] },
  { title: 'More', links: [['Shop', '/shop/'], ['Gallery', '/gallery/'], ['Contact', '/contact/']] },
]

/** `logo` is the club logo from Admin → Logo & colours (the bundled badge until one is uploaded). */
export function SiteFooter({ club, logo }: { club: Club; logo: { src: string; alt: string } }) {
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
      </div>
    </footer>
  )
}
