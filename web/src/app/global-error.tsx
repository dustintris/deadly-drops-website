'use client'

/**
 * Last-resort page when the root layout itself fails (it reads the club info and theme from the
 * database). It replaces the whole document, so it carries its own minimal styling.
 */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#080808', color: '#F4F4F2', fontFamily: 'system-ui, sans-serif' }}>
        <main role="alert" style={{ padding: 24, maxWidth: 480 }}>
          <h1 style={{ fontSize: 28, margin: '0 0 12px' }}>The site didn&rsquo;t load.</h1>
          <p style={{ margin: '0 0 24px', opacity: 0.8 }}>It&rsquo;s usually a short hiccup. Try again in a moment.</p>
          <button type="button" onClick={reset} style={{ font: 'inherit', fontWeight: 700, padding: '12px 22px', border: 0, borderRadius: 999, background: '#C6F24E', color: '#111111', cursor: 'pointer' }}>
            Try again
          </button>
        </main>
      </body>
    </html>
  )
}
