'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { fetchWithAuth, getSession } from '@/lib/session'
import { getApiBaseUrl } from '@/lib/api-base'
import { getSessionEntitlements } from '@/lib/entitlements'

type HealthState =
  | { state: 'checking'; detail: string }
  | { state: 'operational'; detail: string }
  | { state: 'degraded'; detail: string }

export default function SupportPage() {
  const [health, setHealth] = useState<HealthState>({ state: 'checking', detail: 'Checking API health...' })
  const [lastChecked, setLastChecked] = useState<number | null>(null)
  const [subscriptionSummary, setSubscriptionSummary] = useState<string>('Sign in to view your current support lane.')
  const session = useMemo(() => getSession(), [])
  const entitlements = useMemo(() => getSessionEntitlements(), [])
  const statusUrl = process.env.NEXT_PUBLIC_STATUS_PAGE_URL || ''

  useEffect(() => {
    const apiBase = getApiBaseUrl()
    let cancelled = false

    async function loadHealth() {
      try {
        const response = await fetch(`${apiBase}/v1/health`, { cache: 'no-store' })
        if (!response.ok) {
          throw new Error(`Health endpoint returned ${response.status}`)
        }
        const payload = await response.json() as { timestamp?: number }
        if (!cancelled) {
          setHealth({ state: 'operational', detail: 'Core API is healthy and responding.' })
          setLastChecked(payload.timestamp || Date.now())
        }
      } catch (error) {
        if (!cancelled) {
          setHealth({
            state: 'degraded',
            detail: error instanceof Error ? error.message : 'Unable to verify API health',
          })
          setLastChecked(Date.now())
        }
      }
    }

    async function loadSubscriptionSummary() {
      if (!session) return
      try {
        const response = await fetchWithAuth('/v1/billing/subscription')
        const payload = await response.json() as {
          subscription?: {
            plan?: string
            status?: string
          }
        }
        if (!cancelled) {
          const plan = (payload.subscription?.plan || 'free').toUpperCase()
          const status = payload.subscription?.status || 'inactive'
          setSubscriptionSummary(`Plan ${plan} (${status}) · Support lane: ${entitlements.features.supportChannel}`)
        }
      } catch {
        if (!cancelled) {
          setSubscriptionSummary(`Support lane: ${entitlements.features.supportChannel}`)
        }
      }
    }

    void loadHealth()
    void loadSubscriptionSummary()

    return () => {
      cancelled = true
    }
  }, [session, entitlements.features.supportChannel])

  const statusTone =
    health.state === 'operational'
      ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-200'
      : health.state === 'degraded'
      ? 'border-amber-500/35 bg-amber-500/10 text-amber-200'
      : 'border-cyan-500/35 bg-cyan-500/10 text-cyan-100'

  return (
    <main className="legal-shell theme-minimal theme-bg theme-text">
      <section className="legal-card">
        <header className="legal-header">
          <h1>Support & Status</h1>
          <p>Live system health, support lanes, and incident response paths.</p>
          <nav>
            <Link href="/">Back to app</Link>
          </nav>
        </header>

        <section className={`rounded border p-4 text-sm ${statusTone}`}>
          <p className="text-xs uppercase tracking-wide opacity-80">Runtime status</p>
          <p className="mt-1 font-semibold">{health.state.toUpperCase()}</p>
          <p className="mt-1 opacity-90">{health.detail}</p>
          <p className="mt-2 text-xs opacity-75">
            Last checked: {lastChecked ? new Date(lastChecked).toLocaleString() : 'Checking...'}
          </p>
          {statusUrl && (
            <a href={statusUrl} target="_blank" rel="noreferrer" className="mt-3 inline-block underline">
              Open external status page
            </a>
          )}
        </section>

        <section className="billing-notes mt-5">
          <h3>Support lane</h3>
          <ul>
            <li>{subscriptionSummary}</li>
            <li>Community: self-serve docs and async response window.</li>
            <li>Priority: faster response and structured triage for Pro.</li>
            <li>Dedicated: named escalation path and incident bridge for Enterprise.</li>
          </ul>
        </section>

        <section className="billing-notes mt-5">
          <h3>Operational drills</h3>
          <ul>
            <li>Webhook replay drill: re-run Stripe event delivery and verify subscription sync.</li>
            <li>Payout/refund drill: execute one payout review and one refund simulation per release.</li>
            <li>Runbook reference: docs/stripe-payout-refund-runbook.md</li>
            <li>Evidence template: docs/stripe-production-evidence.md</li>
          </ul>
        </section>
      </section>
    </main>
  )
}
