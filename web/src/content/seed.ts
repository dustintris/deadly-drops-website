/**
 * Starting content for the MIS. Built from the real club facts (club.ts), shop and photos (real.ts)
 * and community posts (community.ts), all from deadlydropspickleball.com. The store serves this until the owner publishes their first change.
 */
import type { SiteContent } from '@/lib/content-schema'
import { defaultTheme } from '@/theme/tokens'
import { aboutPoints, club, events, faqs, tickerItems } from './club'
import { communityPosts } from './community'
import { clubGallery, shopProducts } from './real'
import { MEMBER_DISCOUNT } from './sample'

const id = (prefix: string, i: number) => `${prefix}-${String(i + 1).padStart(3, '0')}`

export function buildSeed(): SiteContent {
  return {
    schemaVersion: 1,
    rev: 0,
    updatedAt: new Date(0).toISOString(),
    settings: {
      ...club,
      social: club.social ?? {},
      aboutPoints,
      notice: { enabled: true, text: 'Preview build · member names, ratings and results are sample content' },
      shop: { memberDiscount: MEMBER_DISCOUNT, pickupNote: 'Free pickup at the courts' },
    },
    theme: { ...defaultTheme },
    events: events.map((e, i) => ({
      ...e,
      id: id('event', i),
      featured: i === 0,
      visible: true,
      entryFeeWithMeal: e.entryFeeWithMeal,
    })),
    ticker: tickerItems.map((t, i) => ({ id: id('tick', i), text: t, visible: true })),
    products: shopProducts.map((p, i) => ({ ...p, id: id('product', i), images: p.images ?? [], stock: null, visible: true })),
    media: [],
    gallery: clubGallery.map((g, i) => ({
      id: id('photo', i),
      image: { src: g.src, alt: g.alt ?? g.caption, position: g.position },
      caption: g.caption,
      meta: g.meta,
      album: g.album,
      wide: !!g.wide,
      shotBy: g.shotBy,
      visible: true,
    })),
    posts: communityPosts,
    faqs: faqs.map((f, i) => ({ id: id('faq', i), ...f, visible: true })),
    pages: {
      home: {
        eyebrow: 'Open to all · earned by play',
        title: 'Everybody’s welcome. *Nobody* coasts.',
        lede: 'Deadly Drops Pickleball is the premier destination for players in Chula Vista: structured division tournaments, engaging community events, and a vibrant court culture built for everyone who loves the sport.',
        heroImage: { src: '/images/club/dominate-play-5.jpg', alt: '', position: '75% 40%' },
        heroImageMobile: { src: '/images/club/court-group-photo.jpg', alt: '', position: '50% 50%' },
      },
      about: {
        eyebrow: club.city,
        title: 'Who and what is Deadly Drops Pickleball?',
        lede: club.tagline,
        heroImage: { src: '/images/club/court-group-photo-2.jpg', alt: '', position: '50% 40%' },
      },
      shop: { eyebrow: 'Simply Merch', title: 'Wear the drop', lede: 'Deadly Drops Pickleball™ performance athletic apparel, engineered for fierce play. The online store is launching soon.' },
      gallery: { eyebrow: '', title: 'Our time on court', lede: 'Highlights from DOMINATE 2026, our very first tournament, and from social play. Send us yours and we’ll add them.' },
      contact: {
        eyebrow: '',
        title: 'Ask us anything',
        lede: 'A real member reads these. If it’s about your first tournament, say so and we’ll walk you through it.',
        heroImage: { src: '/images/club/dominate-play-3.jpg', alt: '' },
      },
      community: {
        eyebrow: 'Community',
        title: 'The people who *make* the club',
        lede: 'Photos from the courts, club news and stories from the players who keep showing up.',
        heroImage: { src: '/images/club/toy-drive-celebration.jpg', alt: '', position: '50% 40%' },
      },
    },
  }
}
