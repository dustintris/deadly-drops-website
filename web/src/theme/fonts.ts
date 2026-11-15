import localFont from 'next/font/local'

/* Self-hosted Google Fonts (SIL Open Font License, see src/fonts/LICENSES.txt). */

export const display = localFont({
  src: [{ path: '../fonts/anton-400.woff2', weight: '400', style: 'normal' }],
  variable: '--font-display',
  display: 'swap',
  fallback: ['Impact', 'Arial Narrow', 'sans-serif'],
})

export const body = localFont({
  src: [
    { path: '../fonts/barlow-400.woff2', weight: '400', style: 'normal' },
    { path: '../fonts/barlow-500.woff2', weight: '500', style: 'normal' },
    { path: '../fonts/barlow-600.woff2', weight: '600', style: 'normal' },
    { path: '../fonts/barlow-600-italic.woff2', weight: '600', style: 'italic' },
    { path: '../fonts/barlow-700.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-body',
  display: 'swap',
  fallback: ['system-ui', 'Segoe UI', 'sans-serif'],
})

export const mono = localFont({
  src: [{ path: '../fonts/jetbrains-mono-variable.woff2', weight: '400 700', style: 'normal' }],
  variable: '--font-mono',
  display: 'swap',
  fallback: ['ui-monospace', 'Menlo', 'monospace'],
})
