import { getApiBaseUrl } from '@/lib/api-base'

export interface AuthSession {
  accessToken: string
  refreshToken: string
  user: {
    id: string
    email: string
    subscription?: {
      plan: string
      status: string
      currentPeriodEnd?: number
    }
  }
}

const SESSION_KEY = 'ces-auth-session-v1'

export function getSession(): AuthSession | null {
  if (typeof window === 'undefined') return null

  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    return JSON.parse(raw) as AuthSession
  } catch {
    return null
  }
}

export function setSession(session: AuthSession): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function clearSession(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(SESSION_KEY)
}

export function getAccessToken(): string | null {
  return getSession()?.accessToken || null
}

export function authHeaders(): HeadersInit {
  const token = getAccessToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function refreshSessionIfNeeded(): Promise<AuthSession | null> {
  const current = getSession()
  if (!current) return null

  const apiBase = getApiBaseUrl()
  const response = await fetch(`${apiBase}/v1/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: current.refreshToken }),
  })

  if (!response.ok) {
    clearSession()
    return null
  }

  const data = await response.json() as { accessToken: string; refreshToken: string }
  const next: AuthSession = {
    ...current,
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
  }
  setSession(next)
  return next
}

export async function fetchWithAuth(path: string, init: RequestInit = {}): Promise<Response> {
  const apiBase = getApiBaseUrl()
  const session = getSession()
  const headers = new Headers(init.headers || {})
  if (session?.accessToken) {
    headers.set('Authorization', `Bearer ${session.accessToken}`)
  }

  let response = await fetch(`${apiBase}${path}`, { ...init, headers })
  if (response.status !== 401 || !session?.refreshToken) {
    return response
  }

  const refreshed = await refreshSessionIfNeeded()
  if (!refreshed) return response

  const retryHeaders = new Headers(init.headers || {})
  retryHeaders.set('Authorization', `Bearer ${refreshed.accessToken}`)
  response = await fetch(`${apiBase}${path}`, { ...init, headers: retryHeaders })
  return response
}
