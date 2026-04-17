'use client'

import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { trackPageView } from '@/lib/analytics'

export function PageTracker() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    const query = searchParams.toString()
    const path = query ? `${pathname}?${query}` : pathname
    trackPageView(path)
  }, [pathname, searchParams])

  useEffect(() => {
    const onConsentUpdate = () => {
      const query = searchParams.toString()
      const path = query ? `${pathname}?${query}` : pathname
      trackPageView(path)
    }

    window.addEventListener('ces:consent-updated', onConsentUpdate)
    return () => window.removeEventListener('ces:consent-updated', onConsentUpdate)
  }, [pathname, searchParams])

  return null
}
