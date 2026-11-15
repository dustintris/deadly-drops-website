/**
 * SAMPLE CONTENT from the UI mockup. These members, ratings, results, shop
 * items and gallery captions are placeholders so the screens can be clicked
 * through. Replace them with the club's real data (or an API) before launch.
 * Photos in /public/images/stand-in are stock stand-ins, not club photos.
 */
import type {
  BracketRound,
  Division,
  GalleryItem,
  LadderEntry,
  MatchResult,
  Member,
  Product,
  Spotlight,
} from '@/lib/types'

const NAMES = [
  'Marisol Reyes', 'Danilo Cruz', 'Aracely Mendoza', 'Rob Tanaka', 'Yvette Salgado', 'Marcus Ibarra',
  'Lourdes Pineda', 'Kenji Okafor', 'Bianca Solano', 'Tony Delgado', 'Rosa Villanueva', 'Hector Aguilar',
  'Priya Raman', 'Ernie Batista', 'Claudia Muñoz', 'Sam Whitfield', 'Noemi Carrillo', 'Dennis Park',
  'Gloria Estrada', 'Ray Villareal', 'Teresa Nakamura', 'Oscar Fuentes', 'Janet Abadilla', 'Luis Cabrera',
  'Monique Ferrer', 'Greg Halstead', 'Sandra Ocampo', 'Vic Domingo', 'Elena Barraza', 'Mike Sarmiento',
  'Cecilia Rondo', 'Al Ferrante',
]
const STYLES = [
  'Dinker', 'Banger', 'Lefty slice', 'Third-shot drop', 'Wall at the kitchen', 'Never misses',
  'Two-handed backhand', 'Speed-up specialist', 'Lobs, unapologetically', 'Reset artist', 'Poacher', 'Court sense',
]
const FIXED_RATING: Record<string, number> = {
  'Marisol Reyes': 3.52, 'Kenji Okafor': 4.12, 'Hector Aguilar': 3.6, 'Priya Raman': 3.4, 'Ernie Batista': 3.5,
  'Gloria Estrada': 3.2, 'Vic Domingo': 4.1, 'Bianca Solano': 4.05, 'Ray Villareal': 3.85,
}
const FIXED_YEARS: Record<string, number> = { 'Marisol Reyes': 3, 'Kenji Okafor': 5, 'Gloria Estrada': 1 }

const slugify = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

const divisionFor = (r: number): Division =>
  r < 2.75 ? '2.5' : r < 3.25 ? '3.0' : r < 3.75 ? '3.5' : r < 4.25 ? '4.0' : '4.5+'

export const members: Member[] = NAMES.map((name, i) => {
  const parts = name.split(' ')
  const rating = FIXED_RATING[name] ?? 2.4 + ((i * 7) % 22) / 10
  const years = FIXED_YEARS[name] ?? 1 + (i % 5)
  return {
    slug: slugify(name),
    name,
    first: parts[0],
    initials: parts[0][0] + parts[parts.length - 1][0],
    division: divisionFor(rating),
    rating: Math.round(rating * 100) / 100,
    style: STYLES[i % STYLES.length],
    yearsInClub: years,
    memberSince: 2026 - years,
    tone: i,
  }
})

export const memberByName = (name: string): Member => members.find((m) => m.name === name) ?? members[0]

const QUOTES = [
  "I joined at 47 having never held a paddle. Two years later I'm running the Thursday ladder.",
  'Nobody here cares what you shot last weekend. They care whether you showed up.',
  'The 4.5 crew stayed an hour late to fix my serve. That is the club.',
  'I came for the exercise. I stayed for the tournament food and the trash talk.',
  'Beat a guy half my age on court 2. Told everyone. Will keep telling everyone.',
]
const SPOT_PHOTOS = [
  { src: '/images/stand-in/player-forehand-night.jpg', pos: '34% 24%' },
  { src: '/images/stand-in/player-lunge.jpg', pos: '52% 26%' },
  { src: '/images/stand-in/player-palms.jpg', pos: '56% 16%' },
  { src: '/images/stand-in/player-forehand-night.jpg', pos: '30% 30%' },
  { src: '/images/stand-in/player-lunge.jpg', pos: '48% 20%' },
]
export const spotlights: Spotlight[] = [0, 6, 12, 19, 25].map((idx, k) => ({
  ...members[idx],
  quote: QUOTES[k],
  wins: 18 + idx * 3,
  photo: SPOT_PHOTOS[k].src,
  photoPosition: SPOT_PHOTOS[k].pos,
}))

export const ladder: LadderEntry[] = ['Kenji Okafor', 'Bianca Solano', 'Hector Aguilar', 'Ray Villareal', 'Priya Raman', 'Vic Domingo'].map(
  (name, i) => ({ rank: i + 1, member: memberByName(name), points: 1480 - i * 63 }),
)

export const liveMatch = {
  court: 'Court 3',
  division: '4.0 Mixed',
  teamA: { label: 'Reyes / Cruz', lead: memberByName('Marisol Reyes') },
  teamB: { label: 'Okafor / Solano', lead: memberByName('Kenji Okafor') },
  startA: 8,
  startB: 6,
}

export const bracket: BracketRound[] = [
  {
    label: 'Quarterfinals',
    matches: [
      { a: 'Okafor / Solano', aScore: '11', b: 'Cabrera / Ferrer', bScore: '6', winner: 'a' },
      { a: 'Aguilar / Raman', aScore: '11', b: 'Park / Estrada', bScore: '9', winner: 'a' },
      { a: 'Villareal / Nakamura', aScore: '8', b: 'Domingo / Rondo', bScore: '11', winner: 'b' },
      { a: 'Reyes / Cruz', aScore: '11', b: 'Ferrante / Ocampo', bScore: '4', winner: 'a' },
    ],
  },
  {
    label: 'Semifinals',
    matches: [
      { a: 'Okafor / Solano', aScore: '11', b: 'Aguilar / Raman', bScore: '7', winner: 'a' },
      { a: 'Domingo / Rondo', aScore: '9', b: 'Reyes / Cruz', bScore: '11', winner: 'b' },
    ],
  },
  { label: 'Final', matches: [{ a: 'Okafor / Solano', aScore: '–', b: 'Reyes / Cruz', bScore: '–', winner: null }] },
  { label: 'Champion', matches: [{ a: 'TBD', aScore: '–', b: 'TBD', bScore: '–', winner: null }] },
]

export const champions = [
  { event: '3.5 Mixed', pair: 'Reyes / Cruz', detail: 'Beat Aguilar / Raman 11–9, 11–7', lead: memberByName('Marisol Reyes') },
  { event: "4.0 Men's", pair: 'Okafor / Domingo', detail: 'Undefeated all weekend', lead: memberByName('Kenji Okafor') },
  { event: "3.0 Women's", pair: 'Estrada / Ocampo', detail: 'First tournament for both', lead: memberByName('Gloria Estrada') },
]

export const divisionGuide: { division: Division; label: string; note: string }[] = [
  { division: '2.5', label: 'Brand new', note: 'Learning the serve and the kitchen line. Most players are in their first season.' },
  { division: '3.0', label: 'Improver', note: 'Consistent rallies, working on the third-shot drop.' },
  { division: '3.5', label: 'Solid', note: 'The biggest division. Strategy starts to matter more than power.' },
  { division: '4.0', label: 'Strong', note: 'Reliable resets, deliberate speed-ups, few unforced errors.' },
  { division: '4.5+', label: 'Sharp', note: "Play these people once and you'll learn something." },
]

export const committee = [
  { member: memberByName('Ray Villareal'), role: 'Founder · court booking', note: 'Taped the first lines.' },
  { member: memberByName('Marisol Reyes'), role: 'Ladder & ratings', note: 'Runs ladder night, settles every dispute.' },
  { member: memberByName('Kenji Okafor'), role: 'Tournament director', note: 'Writes the brackets, plays them too.' },
  { member: memberByName('Gloria Estrada'), role: 'New members', note: 'Your first email will be from her.' },
]

export const products: Product[] = [
  { slug: 'deadly-drops-tee', name: 'Deadly Drops Tee', sub: 'Lime on black · unisex', price: 32, tag: 'NEW', category: 'Apparel',
    options: [{ label: 'Size', values: ['S', 'M', 'L', 'XL'] }] },
  { slug: 'club-paddle', name: 'Club Paddle', sub: '16mm carbon face', price: 149, tag: 'MEMBER', category: 'Paddles',
    description: 'Raw carbon face with a 16mm polymer core: forgiving on soft hands, still plenty of pop when you need to speed one up. Elongated handle suits two-handed backhands. Club crest on the throat.',
    options: [{ label: 'Grip size', values: ['4"', '4 ¼"', '4 ½"'] }, { label: 'Edge colour', values: ['Lime', 'Black', 'White'] }] },
  { slug: 'court-bag', name: 'Court Bag', sub: '6-paddle · lime trim', price: 88, category: 'Gear' },
  { slug: 'blossom-cap', name: 'Blossom Cap', sub: 'Embroidered crest', price: 28, category: 'Apparel' },
  { slug: 'ladder-hoodie', name: 'Ladder Hoodie', sub: 'Heavyweight fleece', price: 64, tag: 'LOW', category: 'Apparel',
    options: [{ label: 'Size', values: ['S', 'M', 'L', 'XL'] }] },
  { slug: 'grip-tape-3-pack', name: 'Grip Tape 3-pack', sub: 'Tacky lime', price: 14, category: 'Gear' },
  { slug: 'indoor-ball-6-pack', name: 'Indoor Ball 6-pack', sub: '40-hole · lime', price: 22, category: 'Balls' },
  { slug: 'court-towel', name: 'Court Towel', sub: 'Waffle cotton', price: 24, category: 'Gear' },
]
export const MEMBER_DISCOUNT = 0.15

export const gallery: GalleryItem[] = [
  { id: 'g1', caption: 'Gold medal match, court 1', meta: 'Tournament day', album: 'Tournaments', src: '/images/stand-in/player-lunge.jpg', position: '50% 30%', wide: true, shotBy: 'Gloria Estrada' },
  { id: 'g2', caption: 'Ladder night, group B', meta: 'Ladder', album: 'Ladder', src: '/images/stand-in/player-forehand-night.jpg', position: '46% 30%' },
  { id: 'g3', caption: 'First-timers clinic', meta: 'Clinic', album: 'Clinics', src: '/images/stand-in/paddle-ball-at-net.jpg', position: '58% 40%' },
  { id: 'g4', caption: 'Kitchen line standoff', meta: 'Tournament day', album: 'Tournaments', src: '/images/stand-in/net-closeup.jpg', position: '40% 50%' },
  { id: 'g5', caption: 'Courtside Fuel lunch break', meta: 'Social', album: 'Socials', src: '/images/stand-in/court-line.jpg', position: '50% 50%' },
  { id: 'g6', caption: 'Drop into the kitchen', meta: 'Tournament day', album: 'Tournaments', src: '/images/stand-in/ball-on-blue-court.jpg', position: '50% 60%', wide: true },
  { id: 'g7', caption: 'Sunset doubles', meta: 'Ladder', album: 'Ladder', src: '/images/stand-in/player-palms.jpg', position: '54% 30%' },
]

/** The signed-in member in this clickable preview */
export const me = {
  member: members[0],
  ladderRank: 17,
  record: '28-11',
  winStreak: 5,
  sessions: 41,
  upcoming: 3,
  ratingDelta: 0.14,
  trend: [3.18, 3.21, 3.19, 3.26, 3.3, 3.28, 3.35, 3.41, 3.38, 3.44, 3.49, 3.52],
  nextMatches: [
    { day: 'THU', title: 'Ladder night · Group B', sub: '6:00 PM · Courts 1–4' },
    { day: 'SAT', title: 'Dominate Charity · round robin', sub: 'Round 1 · Court 3' },
    { day: 'TUE', title: 'Skills clinic: resets', sub: '7:00 PM · Court 5' },
  ],
  results: [
    { result: 'W', opponents: 'Estrada / Park', date: 'Jul 29 · ladder', score: '11–7' },
    { result: 'W', opponents: 'Ferrante / Rondo', date: 'Jul 25 · ladder', score: '11–9' },
    { result: 'L', opponents: 'Okafor / Solano', date: 'Jul 22 · open play', score: '8–11' },
    { result: 'W', opponents: 'Cabrera / Ferrer', date: 'Jul 18 · ladder', score: '11–4' },
  ] as MatchResult[],
  tonight: [
    { member: memberByName('Hector Aguilar'), note: 'Your first match' },
    { member: memberByName('Priya Raman'), note: 'Group B' },
    { member: memberByName('Ernie Batista'), note: 'Group B' },
    { member: memberByName('Gloria Estrada'), note: 'Group B · new member' },
    { member: memberByName('Vic Domingo'), note: 'Ref / rotating in' },
  ],
}
