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
}

export default withPWA({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
})(nextConfig)
