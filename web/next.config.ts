import path from 'node:path'
import type { NextConfig } from 'next'

/**
 * The site runs as a Node server so the owner's MIS (/admin) can save content and images.
 * Host it on a Node server with a persistent disk (Fly.io, Render, a VPS, Docker) and point
 * CONTENT_DIR at that disk. Serverless hosts (Vercel) need the database/blob store adapter
 * instead of the JSON file store: see web/README.md.
 * NEXT_PUBLIC_BASE_PATH serves the site under a sub-path.
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || ''

const nextConfig: NextConfig = {
  basePath: basePath || undefined,
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
  poweredByHeader: false,
  // the repo root has its own package-lock (the old showcase); this app lives in web/
  turbopack: { root: path.resolve(__dirname) },
  experimental: { serverActions: { bodySizeLimit: '1mb' } },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
      {
        source: '/admin/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
          { key: 'Cache-Control', value: 'no-store' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      },
    ]
  },
}

export default nextConfig
