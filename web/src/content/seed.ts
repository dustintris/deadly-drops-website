/**
 * Starting content for the MIS. Built from the real club facts (club.ts), shop and photos (real.ts)
 * and community posts (community.ts), all from deadlydropspickleball.com, and the charities the
 * tournaments play for (charities.ts). The store serves this until the owner publishes their first change.
 */
import type { SiteContent } from '@/lib/content-schema'
import { defaultTheme } from '@/theme/tokens'
import { charities } from './charities'
import { aboutPoints, club, faqs, tickerItems } from './club'
import { communityPosts } from './community'
import { clubGallery, shopProducts } from './real'

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
      // no banner until the owner writes one (Admin → Settings)
      notice: { enabled: false, text: '' },
      // the shop is a catalogue (no online checkout): no member pricing, and a note on how to buy
      shop: { memberDiscount: 0, pickupNote: 'Buy at tournament check-in, or message us to hold your size.' },
    },
    theme: { ...defaultTheme },
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
    charities,
    sponsors: [],
    volunteers: {
      roles: [
        { id: 'vol-checkin', title: 'Check-in desk', body: 'Welcome players as they arrive, tick them off on the check-in screen and hand out their shirts.', visible: true },
        { id: 'vol-score', title: 'Scorekeeping', body: 'Look after a court: enter each game’s score on your phone so the big screen and the website update live.', visible: true },
        { id: 'vol-courts', title: 'Court setup', body: 'Put up nets, signs and banners before play starts, and help pack everything away at the end of the day.', visible: true },
        { id: 'vol-food', title: 'Food & hospitality', body: 'Help serve the players’ meal, keep the water cooler full and the snack table stocked.', visible: true },
        { id: 'vol-photos', title: 'Photos & social', body: 'Capture the best rallies and the podium moments for the gallery and the club’s social pages.', visible: true },
      ],
      perks: [],
      signupOpen: true,
      signupNote: 'Tell us which tournament and which role you’d like. We’ll reply with the details for the day.',
    },
    pages: {
      home: {
        eyebrow: 'Open to all · earned by play',
        title: 'Everybody’s welcome. *Nobody* coasts.',
        lede: 'Deadly Drops Pickleball runs charity pickleball tournaments in Chula Vista: divisions by age bracket and DUPR level, friendly round robins, and every tournament plays for a cause.',
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
      sponsors: {
        eyebrow: 'Sponsors',
        title: 'The people who *back* us',
        lede: 'Every Deadly Drops tournament plays for charity, and our sponsors help make that happen. Thank you to each one of them.',
        heroImage: { src: '/images/club/dominate-play-5.jpg', alt: '', position: '75% 40%' },
      },
      volunteers: {
        eyebrow: 'Volunteers',
        title: 'Help us run the *day*',
        lede: 'Tournament days run on volunteers. Check players in, keep score or set up the courts, and be part of the fun without picking up a paddle.',
        heroImage: { src: '/images/club/court-group-photo-2.jpg', alt: '', position: '50% 40%' },
      },
    },
  }
}
