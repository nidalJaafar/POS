import Navigation from '@/components/navigation/Navigation'
import { Poppins } from 'next/font/google'
import React, { Suspense } from 'react'
import './globals.css'
import Spinner from '@/components/Spinner'
import { Metadata, Viewport } from 'next'

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['300'],
})

export const viewport: Viewport = {
  themeColor: [{ media: '(prefers-color-scheme: light)', color: '#fff' }],
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
  keywords: [
    'sunflower crafts',
    'crafts',
    'sunflower',
    'handmade',
    'online shop',
  ],
  authors: [
    {
      name: 'Nidal Jaafar',
    },
  ],
  icons: [
    {
      rel: 'apple-touch-icon',
      url: '/icons/logo-128.png',
    },
    { rel: 'icon', url: '/icons/logo-128.png' },
  ],
}

export default function layout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body
        className={`${poppins.className} bg-white text-charcoal sm:grid sm:grid-cols-[1fr_6fr]`}
      >
        <Navigation />
        <div className="m-10 sm:mx-0 sm:my-10 sm:mr-10">
          <Suspense
            fallback={
              <div className="min-w-screen flex min-h-screen flex-col items-center justify-center">
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
