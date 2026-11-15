import type { Product } from '@/lib/types'
import styles from './shop.module.css'

const ICONS: Record<Product['category'], React.ReactNode> = {
  Paddles: (
    <>
      <rect x="30" y="10" width="40" height="52" rx="18" />
      <path d="M44 62h12v26a6 6 0 0 1-12 0Z" />
      <circle cx="50" cy="34" r="7" strokeDasharray="3 4" />
    </>
  ),
  Apparel: <path d="M36 14 22 22l-10 18 14 7 6-10v51h36V37l6 10 14-7-10-18-14-8c-2 7-8 11-14 11s-12-4-14-11Z" />,
  Gear: (
    <>
      <rect x="16" y="34" width="68" height="44" rx="10" />
      <path d="M36 34v-8a6 6 0 0 1 6-6h16a6 6 0 0 1 6 6v8M16 52h68" />
    </>
  ),
  Balls: (
    <>
      <circle cx="50" cy="50" r="32" />
      {[[40, 34], [58, 36], [36, 52], [52, 50], [66, 54], [44, 66], [60, 68]].map(([x, y]) => (
        <circle key={`${x}${y}`} cx={x} cy={y} r="3.4" />
      ))}
    </>
  ),
}

/**
 * Product illustration shown until the club supplies product photography.
 * Production: replace with <img src={product.photo}> once photos exist.
 */
export function ProductArt({ product, large = false }: { product: Product; large?: boolean }) {
  return (
    <div className={`${styles.art} ${large ? styles.artLarge : ''}`} role="img" aria-label={`${product.name} illustration`}>
      <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        {ICONS[product.category]}
      </svg>
      <span>{product.category}</span>
    </div>
  )
}
