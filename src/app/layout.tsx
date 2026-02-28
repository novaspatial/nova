import { type Metadata } from 'next'
import localFont from 'next/font/local'

import '@/styles/tailwind.css'

const monaSans = localFont({
  src: '../fonts/Mona-Sans.var.woff2',
  display: 'swap',
  variable: '--font-mona-sans',
  weight: '200 900',
  style: 'normal',
})

export const metadata: Metadata = {
  title: {
    template: '%s - Studio',
    default: 'Studio - Award winning developer studio based in Denmark',
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`h-full bg-zinc-950 text-base antialiased ${monaSans.variable}`} suppressHydrationWarning>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  )
}
