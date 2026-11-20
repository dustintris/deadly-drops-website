'use client'

import { defaultTheme } from '@/theme/tokens'

/**
 * Last-resort page when the root layout itself fails (it reads the club info and theme from the
 * database). It replaces the whole document, so it carries its own minimal styling: the default
 * colours from src/theme/tokens.ts, read directly because the saved theme can't be read here.
 */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = defaultTheme
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: '100vh', display: 'grid', placeItems: 'center', background: t.bg, color: t.ink, fontFamily: 'system-ui, sans-serif' }}>
        <main role="alert" style={{ padding: 24, maxWidth: 480 }}>
          <h1 style={{ fontSize: 28, margin: '0 0 12px' }}>The site didn&rsquo;t load.</h1>
          <p style={{ margin: '0 0 24px', opacity: 0.8 }}>It&rsquo;s usually a short hiccup. Try again in a moment.</p>
          <button type="button" onClick={reset} style={{ font: 'inherit', fontWeight: 700, padding: '12px 22px', border: 0, borderRadius: 999, background: t.accent, color: t.onAccent, cursor: 'pointer' }}>
            Try again
          </button>
        </main>
      </body>
    </html>
  )
}
