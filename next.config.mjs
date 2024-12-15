/** @type {import('next').NextConfig} */
import withPWA from 'next-pwa'

const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: `${process.env.SUPABASE_PROJECT_ID}.supabase.co`,
      },
    ],
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
  disable: process.env.NODE_ENV === 'development',
})(nextConfig)
