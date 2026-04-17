import { canTrackAnalytics } from '@/lib/consent'

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
    plausible?: (eventName: string, options?: { props?: Record<string, string | number | boolean> }) => void
  }
}

let initialized = false

function ensureGtag(): void {
  if (typeof window === 'undefined') return
  const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID
  if (!gaId) return

  if (!document.getElementById('ga-script-src')) {
    const script = document.createElement('script')
    script.id = 'ga-script-src'
    script.async = true
    script.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`
    document.head.appendChild(script)
  }

  if (!document.getElementById('ga-script-inline')) {
    const inline = document.createElement('script')
    inline.id = 'ga-script-inline'
    inline.innerHTML = [
      'window.dataLayer = window.dataLayer || [];',
      'function gtag(){dataLayer.push(arguments);}',
      "gtag('js', new Date());",
      `gtag('config', '${gaId}', { send_page_view: false });`,
    ].join('')
    document.head.appendChild(inline)
  }
}

function ensurePlausible(): void {
  if (typeof window === 'undefined') return
  const domain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN
  if (!domain) return

  if (document.getElementById('plausible-script')) return
  const script = document.createElement('script')
  script.id = 'plausible-script'
  script.defer = true
  script.dataset.domain = domain
  script.src = 'https://plausible.io/js/script.js'
  document.head.appendChild(script)
}

export function initAnalytics(): void {
  if (initialized) return
  if (!canTrackAnalytics()) return

  ensureGtag()
  ensurePlausible()
  initialized = true
}

export function trackPageView(path: string): void {
  if (typeof window === 'undefined') return
  if (!canTrackAnalytics()) return

  initAnalytics()

  const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID
  if (gaId && typeof window.gtag === 'function') {
    window.gtag('event', 'page_view', {
      page_path: path,
      page_location: window.location.href,
      page_title: document.title,
    })
  }

  if (typeof window.plausible === 'function') {
    window.plausible('pageview')
  }
}

export function trackEvent(eventName: string, params: Record<string, string | number | boolean> = {}): void {
  if (typeof window === 'undefined') return
  if (!canTrackAnalytics()) return

  initAnalytics()

  if (typeof window.gtag === 'function') {
    window.gtag('event', eventName, params)
  }

  if (typeof window.plausible === 'function') {
    window.plausible(eventName, { props: params })
  }
}
