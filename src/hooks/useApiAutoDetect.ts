'use client'

import { useEffect } from 'react'
import { useStore } from '@/store'

/**
 * Auto-detect a self-hosted CES API server at the same origin.
 *
 * When the frontend is served behind the docker-compose nginx proxy,
 * /v1/health is available on the same origin. If detected and auth
 * is open (no CES_API_KEY configured), proxy mode activates
 * automatically — users can chat without entering any API keys.
 */
export function useApiAutoDetect() {
  const {
    apiKey,
    ultraplinianApiUrl,
    ultraplinianApiKey,
    setUltraplinianApiUrl,
    setUltraplinianApiKey,
    isHydrated,
  } = useStore()

  useEffect(() => {
    if (!isHydrated) return

    // Skip if user already has a personal OpenRouter key
    if (apiKey) return

    // Skip if user already configured a working non-default API URL
    if (ultraplinianApiUrl && ultraplinianApiUrl !== 'http://localhost:7860' && ultraplinianApiKey) return

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 5000)

    async function detect() {
      try {
        const origin = window.location.origin
        const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'

        const baseCandidates = isLocalhost
          ? ['http://localhost:7860', origin]
          : [origin]

        let apiBase: string | null = null
        for (const base of baseCandidates) {
          const healthRes = await fetch(`${base}/v1/health`, { signal: controller.signal })
          if (!healthRes.ok) continue
          const healthData = await healthRes.json()
          if (healthData?.status === 'ok') {
            apiBase = base
            break
          }
        }

        if (!apiBase) return

        // Step 2: Check if auth is open (no CES_API_KEY required)
        // Try accessing a gated endpoint with a dummy bearer token
        const tierRes = await fetch(`${apiBase}/v1/tier`, {
          headers: { 'Authorization': 'Bearer self-hosted' },
          signal: controller.signal,
        })

        if (tierRes.ok || tierRes.status === 429) {
          // Auth is open or rate-limited (still means auth passed)
          setUltraplinianApiUrl(apiBase)
          if (!ultraplinianApiKey) {
            setUltraplinianApiKey('self-hosted')
          }
          console.log('[CES] Self-hosted API detected (open auth) at', apiBase)
        } else if (tierRes.status === 403 || tierRes.status === 401) {
          // Auth is enabled — user needs a real API key from the host
          // Still set the URL so they only need to enter the key in settings
          setUltraplinianApiUrl(apiBase)
          console.log('[CES] Self-hosted API detected (auth required) at', apiBase)
        }
      } catch {
        // No API at same origin — normal mode
      } finally {
        clearTimeout(timer)
      }
    }

    detect()

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [isHydrated, apiKey, ultraplinianApiUrl, ultraplinianApiKey, setUltraplinianApiUrl, setUltraplinianApiKey])
}
