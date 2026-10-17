import Navigation from '@/components/navigation/Navigation'
import localFont from 'next/font/local'
import React, { Suspense } from 'react'
import './globals.css'
import Spinner from '@/components/Spinner'
import { Metadata, Viewport } from 'next'

// Bundled (src/app/fonts, SIL Open Font License) so builds on the shop laptop never
// depend on reaching Google Fonts
const poppins = localFont({
  src: [
    { path: './fonts/poppins-300.woff2', weight: '300' },
    { path: './fonts/poppins-400.woff2', weight: '400' },
    { path: './fonts/poppins-500.woff2', weight: '500' },
    { path: './fonts/poppins-600.woff2', weight: '600' },
  ],
  fallback: ['Segoe UI', 'system-ui', 'sans-serif'],
})

export const viewport: Viewport = {
  themeColor: [{ media: '(prefers-color-scheme: light)', color: '#fffdf5' }],
  minimumScale: 1,
  initialScale: 1,
  width: 'device-width',
  viewportFit: 'cover',
}

export const metadata: Metadata = {
  title: 'Sunflower Crafts POS',
  description: 'Point of Sale for Sunflower Crafts',
  generator: 'Next.js',
  manifest: '/manifest.json',
  keywords: ['sunflower crafts', 'crafts', 'sunflower', 'handmade', 'online shop'],
  authors: [{ name: 'Nidal Jaafar' }],
  icons: [
    { rel: 'apple-touch-icon', url: '/icons/logo-180.png', sizes: '180x180' },
    { rel: 'icon', url: '/icons/logo-48.png', sizes: '48x48', type: 'image/png' },
    { rel: 'icon', url: '/icons/logo-192.png', sizes: '192x192', type: 'image/png' },
  ],
}

export default function layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${poppins.className} bg-page text-ink sm:grid sm:grid-cols-[220px_1fr]`}>
        <Navigation />
        <div className="m-6 sm:my-10 sm:mr-10 sm:ml-10">
          <Suspense
            fallback={
              <div className="flex min-h-screen w-full items-center justify-center">
                <Spinner />
              </div>
            }
          >
            {children}
          </Suspense>
        </div>
      </body>
    </html>
  )
}
