import type { Metadata } from 'next'
import { JetBrains_Mono } from 'next/font/google'
import { Providers } from '@/components/Providers'
import './globals.css'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://example.com'
const jetBrainsMono = JetBrains_Mono({ subsets: ['latin'], display: 'swap' })

export const metadata: Metadata = {
  title: 'CES',
  description: 'Structured execution workspace for chat, build, debug, research, and decision workflows.',
  keywords: ['CES', 'AI workspace', 'build mode', 'decision engine'],
  authors: [{ name: 'Lysios Lab' }],
  metadataBase: new URL(siteUrl),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'CES',
    description: 'Intent routing, structured outputs, build generation, and execution workflows.',
    type: 'website',
    url: siteUrl,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CES',
    description: 'Intent routing, structured outputs, build generation, and execution workflows.',
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${jetBrainsMono.className} font-mono antialiased`}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
