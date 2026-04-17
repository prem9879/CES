export function getApiBaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_API_BASE_URL?.trim()
  if (fromEnv) return fromEnv.replace(/\/$/, '')

  if (typeof window !== 'undefined') {
    const { hostname, origin } = window.location
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:7860'
    }
    return origin.replace(/\/$/, '')
  }

  return 'http://localhost:7860'
}
