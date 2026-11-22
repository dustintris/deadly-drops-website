import type { Metadata } from 'next'
import Link from 'next/link'
import { AccentTitle } from '@/components/AccentTitle'
import { PageHero } from '@/components/PageHero'
import { CloudEdge } from '@/components/Sky'
import { websiteLabel } from '@/lib/charities'
import type { SponsorT } from '@/lib/content-schema'
import { getEvents, getPageCopy, getSponsors } from '@/lib/data'
import { pageMeta } from '@/lib/seo'
import { groupByLevel, levelAnchor, levelHeading, sponsorAnchor, sponsoredTournaments, sponsorInitials } from '@/lib/sponsors'
import type { ClubEvent } from '@/lib/types'
import { asset, cx } from '@/lib/utils'
import s from './sponsors.module.css'

export const metadata: Metadata = pageMeta(
  'Sponsors',
  'Meet the businesses and people who sponsor Deadly Drops Pickleball charity tournaments in Chula Vista, CA, and find out how to become a sponsor.',
  '/sponsors/',
)

/** Where a sponsor first asks about sponsoring: the contact form, opened on the Sponsorship topic. */
const BECOME_HREF = '/contact/?topic=sponsorship'

/** A level's heading with its level word lit in the accent colour: "*Gold* sponsors", "*Supporters*". */
function LevelTitle({ text }: { text: string }) {
  const [first, ...rest] = text.split(' ')
  return <><span className="accent">{first}</span>{rest.length > 0 && ` ${rest.join(' ')}`}</>
}

function SponsorCard({ sponsor, events }: { sponsor: SponsorT; events: ClubEvent[] }) {
  // only tournaments shown on the site; the admin may have ticked a hidden or since-renamed one
  const backs = sponsoredTournaments(sponsor, events)
  return (
    <li id={sponsorAnchor(sponsor)} className={cx('card', s.sponsor)} data-level={sponsor.level}>
      <div className={s.plate} data-logo={!!sponsor.logo}>
        {sponsor.logo ? (
          <img src={asset(sponsor.logo.src)} alt={sponsor.logo.alt || `${sponsor.name} logo`} loading="lazy" decoding="async" />
        ) : (
          <span className={s.initials} aria-hidden="true">{sponsorInitials(sponsor.name)}</span>
        )}
      </div>
      <div className={s.body}>
        <h3 className={s.name}>{sponsor.name}</h3>
        {sponsor.blurb && <p className={s.blurb}>{sponsor.blurb}</p>}
        {(backs.length > 0 || sponsor.website) && (
          <div className={s.foot}>
            {backs.length > 0 && (
              <div className={s.backs}>
                <p className={s.backsLabel} aria-hidden="true">Sponsors</p>
                <ul className="chips" aria-label={`Tournaments ${sponsor.name} sponsors`}>
                  {backs.map((e) => <li key={e.slug}><Link href={`/tournaments/${e.slug}/`} className="chip">{e.name}</Link></li>)}
                </ul>
              </div>
            )}
            {sponsor.website && (
              <a href={sponsor.website} className={cx('link-arrow', s.site)} target="_blank" rel="noopener noreferrer">
                Visit {websiteLabel(sponsor.website, sponsor.name)} <span aria-hidden="true">↗</span><span className="sr"> (opens in a new tab)</span>
              </a>
            )}
          </div>
        )}
      </div>
    </li>
  )
}

export default async function SponsorsPage() {
  const [copy, sponsors, events] = await Promise.all([getPageCopy('sponsors'), getSponsors(), getEvents()])
  const groups = groupByLevel(sponsors)

  return (
    <>
      <PageHero
        eyebrow={copy.eyebrow || undefined}
        title={<AccentTitle title={copy.title} />}
        lede={copy.lede || undefined}
        photo={copy.heroImage?.src}
        photoPosition={copy.heroImage?.position}
      >
        {groups.length > 1 && (
          <nav aria-label="Sponsor levels on this page">
            <ul className="chips" style={{ listStyle: 'none', padding: 0 }}>
              {groups.map((g) => <li key={g.level}><a href={`#${levelAnchor(g.level)}`} className="chip">{levelHeading(g.level, g.sponsors.length)}</a></li>)}
            </ul>
          </nav>
        )}
        <p><Link href={BECOME_HREF} className="link-arrow">Become a sponsor<span aria-hidden="true">&nbsp;→</span></Link></p>
      </PageHero>

      {groups.length === 0 && (
        <section className={cx('section dark', s.lastBand)} aria-labelledby="sponsors-soon">
          <div className="wrap stack-16" data-reveal>
            <h2 id="sponsors-soon" className="display d-m">Sponsors coming <span className="accent">soon</span></h2>
            <p className="lede">
              We&rsquo;re lining up the businesses and friends who back our charity tournaments, and they&rsquo;ll be thanked right
              here. Check back soon, or be one of the first.
            </p>
            <p><Link href="/tournaments/" className="link-arrow">See the tournaments<span aria-hidden="true">&nbsp;→</span></Link></p>
          </div>
          <CloudEdge />
        </section>
      )}

      {groups.map((g, i) => {
        const titleId = `${levelAnchor(g.level)}-title`
        const last = i === groups.length - 1
        return (
          <section key={g.level} id={levelAnchor(g.level)} className={cx('section', i % 2 ? 'darker' : 'dark', i > 0 && 'rule-top', last && s.lastBand)} aria-labelledby={titleId}>
            <div className="wrap">
              <div className="head-row" data-reveal>
                <h2 id={titleId} className="display d-m"><LevelTitle text={levelHeading(g.level, g.sponsors.length)} /></h2>
              </div>
              {/* role="list": Safari drops list semantics from a list with no bullets */}
              <ul className={s.grid} role="list" data-level={g.level} data-count={g.sponsors.length} data-reveal-stagger>
                {g.sponsors.map((sp) => <SponsorCard key={sp.id} sponsor={sp} events={events} />)}
              </ul>
            </div>
            {/* the last band melts into pink clouds above the blush call to action */}
            {last && <CloudEdge />}
          </section>
        )
      })}

      <section id="become-a-sponsor" className="section light" aria-labelledby="become-title">
        <div className={cx('wrap', s.cta)}>
          <div data-reveal="left">
            <p className="eyebrow">Sponsorship</p>
            <h2 id="become-title" className="display d-m">Become a <span className="accent">sponsor</span></h2>
            <p className="lede">
              Every Deadly Drops tournament plays for charity. Sponsor one and you help us put it on, and every player sees who
              made it happen. Tell us a little about your business and we&rsquo;ll get back to you.
            </p>
            <div className={s.actions}>
              <Link href={BECOME_HREF} className="btn btn-dark">Become a sponsor</Link>
              <Link href="/tournaments/" className="btn btn-ghost">See the tournaments</Link>
            </div>
          </div>
          <div className={cx('card', s.perks)} data-reveal="right">
            <h3>What sponsors get</h3>
            <ul>
              <li>Your logo and a line about you on this page</li>
              <li>Your logo on the page of each tournament you sponsor</li>
              <li>A link to your website from both</li>
              <li>Your name behind a tournament that plays for charity</li>
            </ul>
          </div>
        </div>
      </section>
    </>
  )
}
