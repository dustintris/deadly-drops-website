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
  // self-contained server bundle for the Docker image (deploy/vps)
  output: 'standalone',
  basePath: basePath || undefined,
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
  poweredByHeader: false,
  // the repo root has its own package-lock (the old showcase); this app lives in web/
  turbopack: { root: path.resolve(__dirname) },
  // a whole section is saved at once; long community articles need room
  experimental: { serverActions: { bodySizeLimit: '6mb' } },
  async headers() {
    return [
      {
        source: '/:path*',
        // Strict-Transport-Security, X-Content-Type-Options and Referrer-Policy come from the server's shared
        // Caddy proxy (the ft_common snippet) for every site on it; sending them here too doubled them, with two
        // different HSTS values. Hosting this app anywhere else? Add those three back.
        headers: [
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
          { key: 'Content-Security-Policy', value: "frame-ancestors 'self'; base-uri 'self'; object-src 'none'; form-action 'self'" },
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
