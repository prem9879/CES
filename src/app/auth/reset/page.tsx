'use client'

import { FormEvent, useMemo, useState } from 'react'
import Link from 'next/link'
import { getSupabaseClient } from '@/lib/supabase'

export default function ResetPasswordUpdatePage() {
  const supabase = useMemo(() => {
    try {
      return getSupabaseClient()
    } catch {
      return null
    }
  }, [])

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setMessage('')

    if (!supabase) return

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) {
      setError(updateError.message)
      return
    }

    setMessage('Password updated successfully. You can now sign in.')
  }

  return (
    <main className="legal-shell theme-minimal theme-bg theme-text">
      <section className="legal-card auth-card">
        <header className="legal-header">
          <h1>Set New Password</h1>
          <nav>
            <Link href="/auth/">Back to auth</Link>
          </nav>
        </header>

        <form className="auth-form" onSubmit={onSubmit}>
          <label htmlFor="password">New Password</label>
          <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />

          <label htmlFor="confirmPassword">Confirm Password</label>
          <input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />

          <button type="submit" disabled={!supabase}>Update Password</button>
        </form>

        {message && <p className="auth-message">{message}</p>}
        {error && <p className="auth-error">{error}</p>}
      </section>
    </main>
  )
}
