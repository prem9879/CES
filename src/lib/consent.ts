export type ConsentStatus = 'accepted' | 'declined' | 'unset'

export interface ConsentPreferences {
  status: ConsentStatus
  analytics: boolean
  updatedAt: number
}

export const CONSENT_STORAGE_KEY = 'ces_cookie_consent_v1'
const LEGACY_CONSENT_STORAGE_KEY = 'novaos_cookie_consent_v1'

export function getConsentPreferences(): ConsentPreferences {
  if (typeof window === 'undefined') {
    return {
      status: 'unset',
      analytics: false,
      updatedAt: 0,
    }
  }

  try {
    const raw = window.localStorage.getItem(CONSENT_STORAGE_KEY) || window.localStorage.getItem(LEGACY_CONSENT_STORAGE_KEY)
    if (!raw) {
      return {
        status: 'unset',
        analytics: false,
        updatedAt: 0,
      }
    }

    const parsed = JSON.parse(raw) as Partial<ConsentPreferences>
    return {
      status: parsed.status === 'accepted' || parsed.status === 'declined' ? parsed.status : 'unset',
      analytics: Boolean(parsed.analytics),
      updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : 0,
    }
  } catch {
    return {
      status: 'unset',
      analytics: false,
      updatedAt: 0,
    }
  }
}

export function saveConsentPreferences(preferences: ConsentPreferences): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(preferences))
}

export function canTrackAnalytics(): boolean {
  const prefs = getConsentPreferences()
  return prefs.status === 'accepted' && prefs.analytics
}
