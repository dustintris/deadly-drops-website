import type { Metadata } from 'next'
import { ContactForm } from '@/components/ContactForm'
import c from '@/components/contact.module.css'
import { getClub, getFaqs } from '@/lib/data'
import { asset } from '@/lib/utils'

export const metadata: Metadata = { title: 'Contact us' }

export default async function ContactPage() {
  const [club, faqs] = await Promise.all([getClub(), getFaqs()])
  return (
    <>
      <section className="dark">
        <div className={`wrap ${c.grid}`}>
          <div className={c.formCol}>
            <h1 className="display d-l">Ask us anything</h1>
            <p className="lede">A real member reads these. If it&rsquo;s about your first tournament, say so and we&rsquo;ll walk you through it.</p>
            <ContactForm email={club.email} />
          </div>
          <aside className={c.side}>
            <div className={`photo ${c.photo}`}>
              <img src={asset('/images/stand-in/player-forehand-night.jpg')} alt="" />
              <div>
                <p className="eyebrow">Find us</p>
                <p className="display d-s">{club.city}</p>
              </div>
            </div>
            <div className={c.direct}>
              <p className="eyebrow">Direct</p>
              <a href={`mailto:${club.email}`}>{club.email}</a>
              <a href={club.phoneHref}>{club.phone}</a>
              <span className="muted small">{club.city} {club.postcode}</span>
            </div>
            <div className={c.firstTime}>
              <p className="eyebrow">Never played a tournament?</p>
              <p>Register online, and we place you in a division that fits. Your QR ticket arrives by email for quick check-in.</p>
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
