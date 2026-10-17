/** @type {import('next').NextConfig} */
import { readFileSync } from 'fs'
import withPWA from 'next-pwa'

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

const nextConfig = {
  // Shown in the sidebar and returned by /api/health, so you can tell which release runs
  env: { NEXT_PUBLIC_APP_VERSION: version },
  // The browser tests build into their own folder so they don't clobber a running dev server
  distDir: process.env.NEXT_DIST_DIR || '.next',
  images: {
    // Item images live in public/uploads and are served via /api/uploads; no remote hosts
    remotePatterns: [],
  },
  experimental: {
    serverActions: {
      // Item photos are uploaded through a server action; the default limit is 1 MB
      bodySizeLimit: '15mb',
    },
  },
  async rewrites() {
    return {
      // Serve uploads through a route handler so images added after `next start` load
      beforeFiles: [{ source: '/uploads/:filename', destination: '/api/uploads/:filename' }],
    }
  },
  webpack(config, { isServer }) {
    if (isServer) {
      config.externals.push({
        usb: 'commonjs usb',
        escpos: 'commonjs escpos',
        'escpos-usb': 'commonjs escpos-usb',
      })
    }
    return config
  },
}

export default withPWA({
  dest: 'public',
  register: true,
  skipWaiting: true,
  // Test builds (NEXT_DIST_DIR) would otherwise overwrite public/sw.js with their own precache list
  disable: process.env.NODE_ENV === 'development' || Boolean(process.env.NEXT_DIST_DIR),
})(nextConfig)
