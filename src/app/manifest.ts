import type { MetadataRoute } from 'next'

export const dynamic = 'force-static'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Cognitive Execution System (CES)',
    short_name: 'CES',
    description: 'Offline-capable AI execution workspace with chat, build, debug, and decision modes.',
    start_url: '/',
    display: 'standalone',
    background_color: '#03131f',
    theme_color: '#8deeff',
    icons: [
      {
        src: '/favicon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
    ],
  }
}