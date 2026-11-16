import type { Metadata } from 'next'
import { ContactForm } from '@/components/ContactForm'
import c from '@/components/contact.module.css'
import { AccentTitle } from '@/components/AccentTitle'
import { getClub, getFaqs, getPageCopy } from '@/lib/data'
import { asset } from '@/lib/utils'
import { pageMeta } from '@/lib/seo'

export const metadata: Metadata = pageMeta('Contact us', 'Contact Deadly Drops Pickleball in Chula Vista, CA about joining, tournaments, coaching or a shop order. Email info@deadlydropspickleball.com.', '/contact/')

export default async function ContactPage() {
  const [club, faqs, copy] = await Promise.all([getClub(), getFaqs(), getPageCopy('contact')])
  const photo = copy.heroImage ?? { src: '/images/club/dominate-play-3.jpg', alt: '' }
  return (
    <>
      <section className="dark">
        <div className={`wrap ${c.grid}`}>
          <div className={c.formCol}>
            {copy.eyebrow && <p className="eyebrow">{copy.eyebrow}</p>}
            <h1 className="display d-l"><AccentTitle title={copy.title} /></h1>
            {copy.lede && <p className="lede">{copy.lede}</p>}
            <ContactForm email={club.email} />
          </div>
          <aside className={c.side}>
            <div className={`photo ${c.photo}`}>
              <img src={asset(photo.src)} alt={photo.alt} style={{ objectPosition: photo.position }} />
              <div>
                <p className="eyebrow">Find us</p>
                <p className="display d-s">{club.city}</p>
              </div>
            </div>
            <div className={c.direct}>
              <p className="eyebrow">Direct</p>
              <a href={`mailto:${club.email}`}>{club.email}</a>
              {club.phone && <a href={club.phoneHref}>{club.phone}</a>}
              <span className="muted small">{club.city} {club.postcode}</span>
            </div>
            <div className={c.firstTime}>
              <p className="eyebrow">Never played a tournament?</p>
              <p>Charity tournaments focus on fun, friendly games, a great first taste of competitive play. Email us and we will find you the right division.</p>
            </div>
          </aside>
        </div>
      </section>
      <section className="section-tight darker rule-top">
        <div className="wrap">
          <h2 className="display d-s">Before you write</h2>
          <ul className={c.faqs}>
            {faqs.map((f) => (
              <li key={f.q} className="card card-pad">
                <h3>{f.q}</h3>
                <p>{f.a}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  )
}
