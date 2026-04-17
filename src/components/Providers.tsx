'use client'

import { Suspense, useEffect } from 'react'
import { useStore } from '@/store'
import { startTelemetry } from '@/lib/telemetry'
import { initAnalytics } from '@/lib/analytics'
import { CookieBanner } from '@/components/CookieBanner'
import { PageTracker } from '@/components/PageTracker'
import { PwaInstallPrompt } from '@/components/PwaInstallPrompt'

export function Providers({ children }: { children: React.ReactNode }) {
  const setHydrated = useStore((state) => state.setHydrated)

  useEffect(() => {
    setHydrated()
    startTelemetry()
    initAnalytics()

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((error) => {
        console.warn('[PWA] service worker registration failed:', error)
      })
    }
  }, [setHydrated])

  return (
    <>
      <Suspense fallback={null}>
        <PageTracker />
      </Suspense>
      {children}
      <PwaInstallPrompt />
      <CookieBanner />
    </>
  )
}
