/**
 * REAL club facts, taken from deadlydropspickleball.com (retrieved Nov 2026: pages, tournament flyers,
 * WooCommerce products). This is the MIS seed: once the owner publishes from /admin, the store wins.
 * Anything not confirmed by the club lives in ./sample.ts.
 */
import type { ClubEvent, Club } from '@/lib/types'

export const club: Club = {
  name: 'Deadly Drops Pickleball',
  shortName: 'Deadly Drops',
  tagline: 'Where every serve celebrates community, sport, and style.',
  city: 'Chula Vista, CA',
  postcode: '91915',
  email: 'info@deadlydropspickleball.com',
  // the club masks its phone number on its own site, so it stays off here too (owner can add one in Club info)
  phone: '',
  phoneHref: '',
  about:
    'Deadly Drops Pickleball, founded by a retired U.S. Navy combat veteran, is a San Diego and Chula Vista–based pickleball apparel brand and inclusive, community‑focused social hub dedicated to promoting sportsmanship, skill development, and a welcoming environment for players of all levels.',
  highlights: ['Owned by a retired USN combat veteran', 'Charity tournaments', 'Deadly Drops Friday social play', 'Toy and meal drives', 'Players of all levels'],
  howItWorks: [
    { title: 'Say “Hello!”', body: 'Let’s connect — we’d love to show you our pickleball paddle demo program.' },
    { title: 'Connect & Match', body: 'Pair up with a partner, meet fellow players, and get matched into the perfect division for your skill level.' },
    { title: 'Have Fun!', body: 'Hit the court, enjoy some amazing food, and experience the best vibrant pickleball community in Chula Vista.' },
  ],
  favorites: [
    { title: 'Courtside Fuel', body: 'Fuel your body with our authentic regional tournament meals prepared fresh daily right next to the courts.' },
    { title: 'Elite Gear', body: 'Access professional paddles and exclusive custom bags designed to elevate your competitive performance on the court.' },
    { title: 'Trademark', body: 'The Deadly Drops Pickleball™ logo is a protected trademark, ensuring authenticity in our merchandise and safeguarding the integrity of our brand.' },
  ],
  social: {
    facebook: 'https://www.facebook.com/deadly.drops.pickleball',
    instagram: 'https://www.instagram.com/deadlydropspickleball/',
  },
}

/** The three ways the club describes itself on its About page. */
export const aboutPoints = [
  { title: 'All-Inclusive Vibe', body: 'Founded as a fun hobby that turned into a wide-spread local community, Deadly Drops Pickleball welcomes both beginners and seasoned players.' },
  { title: 'Gatherings & Events', body: 'Known for hosting lively social play sessions (like “Deadly Drops Friday”) and charity tournaments at local facilities such as Better At Pickleball (located at 2800 Olympic Parkway in Chula Vista).' },
  { title: 'Giving Back', body: 'Organizes community outreach and charity drives, including toy and meal drives for local organizations like the Chula Vista Police Foundation.' },
]

export const events: ClubEvent[] = [
  {
    slug: 'victory-dink-for-pink-2026',
    name: 'VICTORY: Dink for Pink',
    summary: 'Our second charity tournament of 2026: a one-day Breast Cancer and Halloween Bash at Better at Pickleball. Pink. Spooky. Friendly. Community-driven.',
    date: '2026-10-17',
    dateLabel: 'Sat, Oct 17, 2026',
    location: 'Better at Pickleball, 2800 Olympic Parkway, Chula Vista, CA',
    entryFee: 65,
    includes: ['Pickle meal of your choice', 'Tournament shirt', 'Best-costume prizes', 'Raffle: $5 a ticket, 5 for $20'],
    format: 'Round robin by age bracket and DUPR level: 7 games to 11, win by 1, no playoffs',
    prizes: [],
    registrationOpen: false,
    registrationUrl: 'https://maincourt.com/events-list/victory-dink-for-pink-breast-cancer-halloween/',
  },
  {
    slug: 'dominate-2026',
    name: 'DOMINATE',
    summary: 'Our very first tournament: two days, 24 age-bracketed divisions, and 100% 911-free. Play for charity, have fun, make friends, make a difference.',
    date: '2026-06-13',
    dateLabel: 'June 13–14, 2026',
    location: 'Better at Pickleball, Olympic Training Center, 2800 Olympic Parkway, Chula Vista, CA 91915',
    entryFee: 55,
    entryFeeWithMeal: undefined,
    includes: ['Tournament shirt', 'Meal', 'Water', '$60 after May 5'],
    format: 'Round robin, 15-minute timed games, up to 8 teams per division',
    prizes: [
      { place: 'Gold', amount: 100 },
      { place: 'Silver', amount: 50 },
      { place: 'Bronze', amount: 25 },
    ],
    registrationOpen: false,
  },
]

/** Lines for the scrolling news ticker. Real facts only. */
export const tickerItems = [
  'VICTORY Dink for Pink: a charity tournament for Breast Cancer Angels',
  'DOMINATE 2026: 24 divisions, 100% 911-free',
  'Deadly Drops Friday social play',
  'Toy and meal drives with the Chula Vista Police Foundation',
  'Paddle demo program: just say hello',
  'Owned by a retired USN combat veteran',
]

export const faqs = [
  {
    q: 'Do I need to be a strong player to enter?',
    a: 'No. Tournaments are built around age brackets and DUPR levels so you play with peers at your pace, and charity events focus on fun, friendly games. They are a great first taste of competitive play.',
  },
  {
    q: 'What does a tournament entry include?',
    a: 'Every registration includes a meal and a tournament shirt. VICTORY 2026 was $65; DOMINATE 2026 was $55 early and $60 after May 5.',
  },
  {
    q: 'Can I try a paddle before I buy one?',
    a: 'Yes. Say hello and ask about our paddle demo program.',
  },
  {
    q: 'Where do you play?',
    a: 'Tournaments are at Better at Pickleball, 2800 Olympic Parkway, Chula Vista. Social play includes Deadly Drops Friday. Email us for the next session.',
  },
]
