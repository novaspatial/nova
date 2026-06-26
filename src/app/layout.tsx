import { type Metadata, type Viewport } from 'next'
import localFont from 'next/font/local'

import { SITE_NAME, SITE_URL } from '@/lib/site'
import '@/styles/tailwind.css'

const monaSans = localFont({
  src: '../fonts/Mona-Sans.var.woff2',
  display: 'swap',
  variable: '--font-mona-sans',
  weight: '200 900',
  style: 'normal',
})

const siteUrl = SITE_URL
const siteName = SITE_NAME
const defaultTitle = 'NOVA Spatial - World-Class Dolby Atmos Mixing Facility'
const defaultDescription =
  'NOVA Spatial is a world-class Dolby Atmos mixing facility delivering immersive spatial audio for music, film, and broadcast.'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    template: '%s - NOVA Spatial',
    default: defaultTitle,
  },
  description: defaultDescription,
  applicationName: siteName,
  generator: 'Next.js',
  referrer: 'origin-when-cross-origin',
  keywords: [
    'Dolby Atmos',
    'Atmos mixing',
    'spatial audio',
    'immersive audio',
    'mixing studio',
    'mastering',
    'post production',
    'music production',
    'NOVA Spatial',
  ],
  authors: [{ name: siteName, url: siteUrl }],
  creator: siteName,
  publisher: siteName,
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: siteUrl,
    siteName,
    title: defaultTitle,
    description: defaultDescription,
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'NOVA Spatial — Dolby Atmos Mixing Facility',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: defaultTitle,
    description: defaultDescription,
    images: ['/og-image.jpg'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  manifest: '/site.webmanifest',
  category: 'music',
}

export const viewport: Viewport = {
  themeColor: '#09090b',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`h-full bg-zinc-950 text-base antialiased ${monaSans.variable}`} suppressHydrationWarning>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  )
}
