/**
 * The arithmetic behind the gallery's featured carousel (src/components/GalleryCarousel.tsx): which photo
 * comes next, which photo the track has stopped on, which photos load straight away, and which dots show.
 * Kept out of the component so it can be tested without a browser.
 */

/** Stepping past either end comes round to the other: after photo 17 comes photo 1, before photo 1 comes 17. */
export const wrap = (i: number, count: number) => (count > 0 ? ((i % count) + count) % count : 0)

/**
 * The slide a swiped track has come to rest on (or is passing halfway over): the nearest one, and never
 * outside the list, even while the track bounces past an end.
 */
export function slideAt(scrollLeft: number, slideWidth: number, count: number) {
  if (slideWidth <= 0 || count <= 0) return 0
  return Math.min(count - 1, Math.max(0, Math.round(scrollLeft / slideWidth)))
}

/**
 * Only the photo on show and the one either side of it (round the ends too, as Previous and Next wrap)
 * load at once, so the next swipe never lands on a blank; every other photo waits (loading="lazy").
 */
export function loadsEagerly(i: number, current: number, count: number) {
  if (count <= 0) return false
  const apart = Math.abs(wrap(i, count) - wrap(current, count))
  return apart <= 1 || apart === count - 1
}

/** A step to the photo beside this one glides there; a longer jump (or round the end) cuts straight to it. */
export const isNeighbour = (from: number, to: number) => Math.abs(from - to) === 1

/**
 * The dots under the photo: one per photo, but past `max` photos only a window of `max` dots that
 * follows the current one, with an end dot drawn smaller while there are more photos beyond it.
 * So 60 photos still fit a phone, without loading a thumbnail of each.
 */
export function dotWindow(current: number, count: number, max = 7): { i: number; edge: boolean }[] {
  if (count <= 1 || max <= 0) return []
  const size = Math.min(count, max)
  const from = Math.min(Math.max(0, current - Math.floor(size / 2)), count - size)
  return Array.from({ length: size }, (_, k) => ({
    i: from + k,
    edge: (k === 0 && from > 0) || (k === size - 1 && from + size < count),
  }))
}
