/**
 * Real shop items and photos from deadlydropspickleball.com (WooCommerce products and the
 * DOMINATE 2026 / community galleries). Photos live in /public/images/club, resized for the web.
 */
import type { GalleryItem, Product } from '@/lib/types'

const img = (name: string, alt: string, position?: string) => ({ src: `/images/club/${name}.jpg`, alt, position })

export const shopProducts: Product[] = [
  {
    slug: 'dry-fit-t-shirt',
    name: 'Dry Fit T-Shirt',
    sub: 'Black · 89% polyester, 11% spandex',
    price: 25,
    tag: 'NEW',
    category: 'Apparel',
    description: '11% Spandex, 89% Polyester. Deadly Drops Pickleball™ performance athletic apparel, engineered for fierce play.',
    images: [
      img('shop-dry-fit-tee-1', 'Black Deadly Drops dry fit t-shirt'),
      img('shop-dry-fit-tee-2', 'Dry fit t-shirt, second view'),
      img('shop-dry-fit-tee-3', 'Dry fit t-shirt, detail'),
    ],
  },
  {
    slug: 'dri-fit-mesh-unisex-t-shirt',
    name: 'Dry Fit T-Shirt (Red)',
    sub: 'Red · 89% polyester, 11% spandex',
    price: 25,
    category: 'Apparel',
    description: '11% Spandex, 89% Polyester.',
    images: [img('shop-dry-fit-tee-red', 'Red Deadly Drops dry fit t-shirt')],
  },
  {
    slug: 'unisex-crewneck',
    name: 'Unisex Crewneck',
    sub: 'Black crewneck',
    price: 25,
    category: 'Apparel',
    images: [img('shop-crewneck-1', 'Black Deadly Drops unisex crewneck'), img('shop-crewneck-2', 'Unisex crewneck, worn')],
  },
]

const g = (id: string, name: string, caption: string, meta: string, album: GalleryItem['album'], opts: Partial<GalleryItem> = {}): GalleryItem => ({
  id, src: `/images/club/${name}.jpg`, position: '50% 40%', caption, meta, album, alt: caption, ...opts,
})

export const clubGallery: GalleryItem[] = [
  g('c01', 'dominate-podium-1', 'DOMINATE medal round', 'DOMINATE · June 2026', 'Tournaments', { wide: true }),
  g('c02', 'dominate-play-1', 'Play on court 1', 'DOMINATE · June 2026', 'Tournaments', { shotBy: 'Clara Barra' }),
  g('c03', 'dominate-play-3', 'At the kitchen line', 'DOMINATE · June 2026', 'Tournaments', { shotBy: 'Clara Barra' }),
  g('c04', 'court-group-photo', 'The Deadly Drops crew', 'Community', 'Community', { wide: true }),
  g('c05', 'dominate-podium-2', 'Gold, silver and bronze', 'DOMINATE · June 2026', 'Tournaments'),
  g('c06', 'courtside-fuel-grill', 'Courtside Fuel on the grill', 'Tournament day', 'Socials'),
  g('c07', 'dominate-play-5', 'Doubles under the June sun', 'DOMINATE · June 2026', 'Tournaments', { shotBy: 'Clara Barra' }),
  g('c08', 'toy-drive-celebration', 'Toy drive thank-you with the Chula Vista Cadets', 'April 2026', 'Community', { wide: true }),
  g('c09', 'dominate-medals', 'Medals ready for the podium', 'DOMINATE · June 2026', 'Tournaments'),
  g('c10', 'backyard-court-gathering', 'Social play at the backyard court', 'Deadly Drops Friday', 'Socials'),
  g('c11', 'dominate-play-7', 'Ready position', 'DOMINATE · June 2026', 'Tournaments', { shotBy: 'Clara Barra' }),
  g('c12', 'elite-gear-paddle-bags', 'Elite Gear: custom paddle bags', 'Club gear', 'Socials'),
  g('c13', 'dominate-podium-3', 'Division winners', 'DOMINATE · June 2026', 'Tournaments'),
  g('c14', 'dominate-check-in', 'Check-in, 6 AM', 'DOMINATE setup', 'Tournaments'),
  g('c15', 'court-group-photo-2', 'Picklebesties', 'Community', 'Community'),
  g('c16', 'dominate-play-2', 'Third-shot drop', 'DOMINATE · June 2026', 'Tournaments', { shotBy: 'Clara Barra' }),
]
