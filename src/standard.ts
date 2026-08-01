/** Scroll-reveal animations for the Standard and Premium tiers. */
export function initReveals(): void {
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible')
          observer.unobserve(entry.target)
        }
      }
    },
    { threshold: 0.15 },
  )
  document.querySelectorAll('.reveal').forEach((el) => observer.observe(el))
}

initReveals()
