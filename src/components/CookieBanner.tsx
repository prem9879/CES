'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getConsentPreferences, saveConsentPreferences, type ConsentPreferences } from '@/lib/consent'

export function CookieBanner() {
  const [loaded, setLoaded] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const preferences = getConsentPreferences()
    setLoaded(true)
    setVisible(preferences.status === 'unset')
  }, [])

  function persist(preferences: ConsentPreferences) {
    saveConsentPreferences(preferences)
    setVisible(false)

    // Let listeners (like page tracking) re-read consent after user action.
    window.dispatchEvent(new Event('ces:consent-updated'))
  }

  if (!loaded || !visible) return null

  return (
    <div className="cookie-banner" role="dialog" aria-live="polite" aria-label="Cookie consent">
      <div className="cookie-banner__content">
        <p>
          We use essential storage for core app behavior. Optional analytics can be enabled to improve quality.
          Read our <Link href="/cookies-policy/">Cookies Policy</Link> and <Link href="/privacy-policy/">Privacy Policy</Link>.
        </p>
        <div className="cookie-banner__actions">
          <button
            type="button"
            className="cookie-btn cookie-btn--secondary"
            onClick={() => persist({ status: 'declined', analytics: false, updatedAt: Date.now() })}
          >
            Essential Only
          </button>
          <button
            type="button"
            className="cookie-btn cookie-btn--primary"
            onClick={() => persist({ status: 'accepted', analytics: true, updatedAt: Date.now() })}
          >
            Accept Analytics
          </button>
        </div>
      </div>
    </div>
  )
}
