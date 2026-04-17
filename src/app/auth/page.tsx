'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { clearSession, getSession, setSession } from '@/lib/session'
import { getApiBaseUrl } from '@/lib/api-base'

export default function AuthPage() {
  const [mode, setMode] = useState<'login' | 'signup' | 'reset'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [activeUserEmail, setActiveUserEmail] = useState<string | null>(null)

  useEffect(() => {
    const session = getSession()
    setActiveUserEmail(session?.user?.email || null)
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    setMessage('')
    setError('')
    setLoading(true)
    const apiBase = getApiBaseUrl()

    try {
      if (mode === 'signup') {
        const response = await fetch(`${apiBase}/v1/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        })
        const payload = await response.json()
        if (!response.ok) {
          throw new Error(payload.error || 'Signup failed')
        }
        setMessage('Signup successful. You can now log in with your credentials.')
      }

      if (mode === 'login') {
        const response = await fetch(`${apiBase}/v1/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        })
        const payload = await response.json() as {
          error?: string
          accessToken?: string
          refreshToken?: string
          user?: { id: string; email: string; subscription?: { plan: string; status: string } }
        }
        if (!response.ok || !payload.accessToken || !payload.refreshToken || !payload.user) {
          throw new Error(payload.error || 'Login failed')
        }

        setSession({
          accessToken: payload.accessToken,
          refreshToken: payload.refreshToken,
          user: payload.user,
        })
        setActiveUserEmail(payload.user.email)
        setMessage('Login successful. Session persisted on this device.')
      }

      if (mode === 'reset') {
        setMessage('Password reset flow is not yet enabled on API auth. Use account support for manual reset in this build.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  function handleLogout() {
    clearSession()
    setActiveUserEmail(null)
    setMessage('Signed out and local session cleared.')
    setError('')
  }

  return (
    <main className="legal-shell theme-minimal theme-bg theme-text">
      <section className="legal-card auth-card">
        <header className="legal-header">
          <h1>Authentication</h1>
          <p>Persistent JWT auth with refresh token rotation and protected API access.</p>
          <nav>
            <Link href="/">Back to app</Link>
          </nav>
        </header>

        {activeUserEmail && <p className="auth-message">Signed in as {activeUserEmail}</p>}

        <div className="auth-tabs">
          <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>Login</button>
          <button type="button" className={mode === 'signup' ? 'active' : ''} onClick={() => setMode('signup')}>Signup</button>
          <button type="button" className={mode === 'reset' ? 'active' : ''} onClick={() => setMode('reset')}>Reset Password</button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label htmlFor="email">Email</label>
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />

          {mode !== 'reset' && (
            <>
              <label htmlFor="password">Password</label>
              <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </>
          )}

          <button type="submit" disabled={loading}>{loading ? 'Please wait...' : 'Continue'}</button>
        </form>

        <button type="button" className="oauth-btn" onClick={handleLogout} disabled={loading || !activeUserEmail}>
          Logout
        </button>

        {message && <p className="auth-message">{message}</p>}
        {error && <p className="auth-error">{error}</p>}
      </section>
    </main>
  )
}
