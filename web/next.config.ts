import type { NextConfig } from 'next'

/**
 * Static export by default so the site can be hosted on GitHub Pages or any
 * static host. When a backend is added (auth, payments, live scores), set
 * NEXT_OUTPUT=server and deploy to a Node host such as Vercel.
 * NEXT_PUBLIC_BASE_PATH serves the site under a sub-path, e.g. "/deadly-drops-website".
 */
const isStatic = process.env.NEXT_OUTPUT !== 'server'
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || ''

const nextConfig: NextConfig = {
  output: isStatic ? 'export' : undefined,
  basePath: basePath || undefined,
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
}

export default nextConfig
