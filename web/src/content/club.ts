/**
 * REAL club facts, from deadlydropspickleball.com (as captured in the original
 * showcase site). Anything not confirmed by the club lives in ./sample.ts.
 */
import type { ClubEvent, Club } from '@/lib/types'

export const club: Club = {
  name: 'Deadly Drops Pickleball',
  shortName: 'Deadly Drops',
  tagline: 'Become the best pickleball player of yourself.',
  city: 'Chula Vista, CA',
  postcode: '91915',
  email: 'info@deadlydropspickleball.com',
  phone: '1.619.888.1411',
  phoneHref: 'tel:+16198881411',
  about:
    'Deadly Drops Pickleball is a premier destination for players in Chula Vista. We focus on structured tournaments and community events built on sportsmanship, sharpening competitive skills, and an inclusive environment where every age and skill level belongs.',
  highlights: ['Year-round divisions', 'DUPR friendly brackets', 'Senior friendly live scoreboards', 'Charity events with real prizes'],
  howItWorks: [
    {
      title: 'Register online',
      body: 'Sign up for tournaments and events in minutes. A personal QR ticket arrives by email for quick check-in on game day.',
    },
    {
      title: 'Get matched',
      body: 'Connect with partners and get placed in a division that fits your skill level. DUPR ratings keep every bracket fair.',
    },
    {
      title: 'Play and enjoy',
      body: 'Round robin play, live scoreboards, medals, and a community atmosphere that keeps everyone coming back.',
    },
  ],
  favorites: [
    { title: 'Courtside Fuel', body: 'Authentic regional tournament meals prepared fresh daily. Play hard, eat well.' },
    { title: 'Elite Gear', body: 'Professional paddles and custom bags, picked by players for players.' },
    { title: 'Match Play', body: 'Division tournaments year round, from friendly ladders to championship brackets.' },
  ],
}

export const events: ClubEvent[] = [
  {
    slug: 'dominate-charity-2026',
    name: 'Dominate Charity 2026',
    summary: 'Our pink charity classic. Round robin into a medal round, live scoreboards on site.',
    // The club has not published a date yet. Set an ISO date to switch on the countdown.
    date: null,
    dateLabel: 'Date to be announced',
    entryFee: 55,
    entryFeeWithMeal: 65,
    includes: ['Tournament shirt', 'Medals for every podium', 'Live scoreboards'],
    format: 'Round robin into a medal round',
    prizes: [
      { place: 'Gold', amount: 100 },
      { place: 'Silver', amount: 75 },
      { place: 'Bronze', amount: 50 },
    ],
    registrationOpen: true,
  },
]

/** Lines for the scrolling news ticker. Real facts only. */
export const tickerItems = [
  'Dominate Charity 2026: registration open',
  'Entry $55, or $65 with a tournament meal',
  'Gold $100 · Silver $75 · Bronze $50',
  'Tournament shirt included',
  'DUPR friendly divisions',
  'Courtside Fuel cooking on site',
]

export const faqs = [
  {
    q: 'What does a tournament cost?',
    a: 'Dominate Charity 2026 is $55 per player, or $65 with an authentic tournament meal. A tournament shirt is included either way.',
  },
  {
    q: 'How are divisions decided?',
    a: 'We place you in a division that fits your skill level. DUPR ratings keep every bracket fair.',
  },
  {
    q: 'How does check-in work?',
    a: 'After you register you get a personal QR ticket by email. Show it at the desk on game day.',
  },
]
