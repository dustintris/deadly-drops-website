'use client'

/** Shown when a page fails to load (for example the database is briefly unreachable). */
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className="section">
      <div className="wrap" role="alert">
        <p className="eyebrow">Something went wrong</p>
        <h1 className="display d-l">This page didn&rsquo;t load.</h1>
        <p style={{ margin: '16px 0 28px' }}>It&rsquo;s usually a short hiccup. Try again in a moment.</p>
        <button type="button" className="btn" onClick={reset}>Try again</button>
      </div>
    </section>
  )
}
