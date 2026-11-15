export type Club = {
  name: string
  shortName: string
  tagline: string
  city: string
  postcode: string
  email: string
  phone: string
  phoneHref: string
  about: string
  highlights: string[]
  howItWorks: { title: string; body: string }[]
  favorites: { title: string; body: string }[]
}

export type Prize = { place: 'Gold' | 'Silver' | 'Bronze'; amount: number }

export type ClubEvent = {
  slug: string
  name: string
  summary: string
  /** ISO date of day one, or null while unannounced */
  date: string | null
  dateLabel: string
  entryFee: number
  entryFeeWithMeal?: number
  includes: string[]
  format: string
  prizes: Prize[]
  registrationOpen: boolean
}

export type Division = '2.5' | '3.0' | '3.5' | '4.0' | '4.5+'

export type Member = {
  slug: string
  name: string
  first: string
  initials: string
  division: Division
  rating: number
  style: string
  yearsInClub: number
  memberSince: number
  /** index used to pick a monogram tone */
  tone: number
  photo?: string
}

export type Spotlight = Member & { quote: string; wins: number; photo: string; photoPosition: string }

export type LadderEntry = { rank: number; member: Member; points: number }

export type BracketMatch = { a: string; aScore: string; b: string; bScore: string; winner: 'a' | 'b' | null }
export type BracketRound = { label: string; matches: BracketMatch[] }

export type Product = {
  slug: string
  name: string
  sub: string
  price: number
  tag?: 'NEW' | 'MEMBER' | 'LOW'
  category: 'Paddles' | 'Apparel' | 'Gear' | 'Balls'
  description?: string
  options?: { label: string; values: string[] }[]
}

export type GalleryItem = {
  id: string
  caption: string
  meta: string
  album: 'Tournaments' | 'Ladder' | 'Clinics' | 'Socials'
  src: string
  position: string
  wide?: boolean
  shotBy?: string
}

export type MatchResult = { result: 'W' | 'L'; opponents: string; date: string; score: string }
