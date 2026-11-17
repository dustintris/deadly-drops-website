import type { Metadata } from 'next'
import Link from 'next/link'
import { AccentTitle } from '@/components/AccentTitle'
import { PageHero } from '@/components/PageHero'
import { CloudEdge } from '@/components/Sky'
import community from '@/components/community.module.css'
import { charityAnchor, websiteLabel } from '@/lib/charities'
import type { CharityT } from '@/lib/content-schema'
import { getCharities, getEvents } from '@/lib/data'
import { RichText } from '@/lib/richtext'
import { pageMeta } from '@/lib/seo'
import type { ClubEvent, ImageRef } from '@/lib/types'
import { asset, cx } from '@/lib/utils'
import s from './charity.module.css'

export const metadata: Metadata = pageMeta(
  'Charity',
  'Every Deadly Drops Pickleball tournament plays for a cause. Meet the charities our Chula Vista tournaments support, read their stories and see how to help.',
  '/charity/',
)

/** The charity's flyer first, then the posters of the tournaments that play for it (each image with a caption). */
function mediaOf(c: CharityT, tournaments: ClubEvent[]): { img: ImageRef; caption: string }[] {
  const out: { img: ImageRef; caption: string }[] = []
  if (c.flyer) out.push({ img: { ...c.flyer, alt: c.flyer.alt || `${c.name} flyer` }, caption: `${c.name} flyer` })
  for (const t of tournaments) {
    if (t.image) out.push({ img: { ...t.image, alt: t.image.alt || `${t.name} poster` }, caption: `${t.name} poster` })
  }
  return out
}

export default async function CharityPage() {
  const [charities, events] = await Promise.all([getCharities(), getEvents()])

  return (
    <>
      <PageHero
        eyebrow="Charity"
        title={<AccentTitle title="Every tournament *gives back*" />}
        lede="Deadly Drops Pickleball runs charity tournaments: play for charity, have fun, make friends, make a difference. Each tournament supports a cause. Here are the charities our players play for, and the tournaments that support them."
        photo="/images/club/dominate-podium-1.jpg"
      >
        {charities.length > 1 && (
          <nav aria-label="Charities on this page">
            <ul className="chips" style={{ listStyle: 'none', padding: 0 }}>
              {charities.map((c) => <li key={c.id}><a href={`#${charityAnchor(c)}`} className="chip">{c.name}</a></li>)}
            </ul>
          </nav>
        )}
      </PageHero>

      {charities.length === 0 && (
        <section className="section dark">
          <div className="wrap stack-16" data-reveal>
            <h2 className="display d-m">Charity partners coming soon</h2>
            <p className="lede">Each tournament&rsquo;s charity is announced with the tournament. <Link href="/tournaments/" className="accent">See the tournaments</Link>.</p>
          </div>
        </section>
      )}

      {charities.map((c, i) => {
        // only tournaments shown on the site; the admin may have ticked a hidden or since-renamed one
        const supported = events.filter((e) => c.tournaments.includes(e.slug))
        const media = mediaOf(c, supported)
        const titleId = `${charityAnchor(c)}-title`
        const last = i === charities.length - 1
        return (
          <section key={c.id} id={charityAnchor(c)} className={cx('section', i % 2 ? 'darker' : 'dark', i > 0 && 'rule-top', last && s.lastBand)} aria-labelledby={titleId}>
            <div className={cx('wrap', s.layout)} data-media={media.length > 0}>
              <div>
                <header className={s.head} data-reveal>
                  {c.logo && <img className={s.logo} src={asset(c.logo.src)} alt={c.logo.alt || `${c.name} logo`} width={96} height={96} />}
                  <div className="stack-8">
                    <p className="eyebrow">{supported.length ? `Supported by ${supported.map((e) => e.name).join(' & ')}` : 'Charity'}</p>
                    <h2 id={titleId} className="display d-l">{c.name}</h2>
                    {c.tagline && <p className={s.tagline}>{c.tagline}</p>}
                  </div>
                </header>

                {c.story.trim() ? <RichText source={c.story} className={cx(community.prose, s.story)} /> : <p className={s.summary}>{c.summary}</p>}
              </div>

              {/* beside the story: the charity's website and its tournaments in a glowing panel, then its flyer and posters
                  (on wide screens the panel stays in view within its track; the images below it scroll normally) */}
              <div className={s.aside}>
                <div className={s.panelTrack}>
                  <div className={cx('card', s.panel)}>
                    <div className={s.actions}>
                      <a href={c.website} className="btn btn-accent" target="_blank" rel="noopener noreferrer">
                        Visit {websiteLabel(c.website, c.name)} <span aria-hidden="true">↗</span><span className="sr"> (opens in a new tab)</span>
                      </a>
                    </div>

                    {supported.length > 0 && (
                      <div className={s.tournaments}>
                        <h3 className="eyebrow">{supported.length === 1 ? 'The tournament' : 'Tournaments'} playing for {c.name}</h3>
                        <ul>
                          {supported.map((e) => (
                            <li key={e.slug}>
                              <Link href={`/tournaments/${e.slug}/`} className={s.tournament}>
                                {e.logo && <img className={s.badge} src={asset(e.logo.src)} alt="" width={48} height={48} />}
                                <span className={s.tName}>
                                  <strong>{e.name}</strong>
                                  <span>{e.dateLabel}{e.location ? ` · ${e.location.split(',')[0]}` : ''}</span>
                                </span>
                                <span className={s.arrow} aria-hidden="true">→</span>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>

                {media.length > 0 && (
                  <div className={s.media} data-count={media.length}>
                    {media.map(({ img, caption }, k) => {
                      // alt text that only repeats the caption below is left empty, so it isn't read out twice;
                      // the caption then also describes the link
                      const sameAsCaption = img.alt.trim().toLowerCase() === caption.toLowerCase()
                      const captionId = `${charityAnchor(c)}-image-${k}`
                      return (
                        <figure key={`${k}-${img.src}`} data-reveal="zoom">
                          {/* flyers are full of small print: open the full image */}
                          <a href={asset(img.src)} target="_blank" rel="noopener noreferrer" aria-describedby={sameAsCaption ? captionId : undefined}>
                            <img src={asset(img.src)} alt={sameAsCaption ? '' : img.alt} loading="lazy" decoding="async" />
                            <span className="sr"> (opens the full image in a new tab)</span>
                          </a>
                          <figcaption id={captionId}>{caption}</figcaption>
                        </figure>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
            {/* the last band melts into pink clouds above the blush call to action */}
            {last && <CloudEdge />}
          </section>
        )
      })}

      <section className="section light">
        <div className={cx('wrap', s.cta)} data-reveal>
          <h2 className="display d-m">Play for a cause</h2>
          <p className="lede">The easiest way to help is to play: every Deadly Drops tournament is a charity tournament, and every registration includes a meal and a tournament shirt.</p>
          <div className={s.actions}>
            <Link href="/tournaments/" className="btn btn-dark">See the tournaments</Link>
            <Link href="/contact/" className="btn btn-ghost">Get in touch</Link>
          </div>
        </div>
      </section>
    </>
  )
}
