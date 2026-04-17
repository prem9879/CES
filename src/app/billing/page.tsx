"use client"

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { fetchWithAuth, getSession } from '@/lib/session'

const plans = [
  {
    name: 'Starter',
    price: '$0',
    description: 'For evaluation and light usage.',
    cta: 'Current Free Plan',
    href: '',
  },
  {
    name: 'Pro',
    price: '$29/mo',
    description: 'Priority performance and expanded limits.',
    cta: 'Upgrade to Pro',
    href: process.env.NEXT_PUBLIC_STRIPE_LINK_PRO || '',
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    description: 'Advanced controls, SSO, and enterprise SLAs.',
    cta: 'Contact Sales',
    href: process.env.NEXT_PUBLIC_STRIPE_LINK_ENTERPRISE || 'mailto:sales@example.com',
  },
]

const comparisonRows: Array<{ feature: string; pro: string; enterprise: string }> = [
  { feature: 'Seat model', pro: 'Single team, self-serve', enterprise: 'Multi-team and cost center controls' },
  { feature: 'Authentication', pro: 'Email and password', enterprise: 'SSO (SAML/OIDC) and SCIM provisioning' },
  { feature: 'Admin controls', pro: 'Standard account settings', enterprise: 'Role-based admin console and approvals' },
  { feature: 'Audit trail', pro: 'Basic activity events', enterprise: 'Exportable audit logs and retention policies' },
  { feature: 'Support and SLA', pro: 'Business-hours support', enterprise: 'Priority support and negotiated SLA' },
]

export default function BillingPage() {
  const [loading, setLoading] = useState(false)
  const [portalLoading, setPortalLoading] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [error, setError] = useState('')
  const [subscription, setSubscription] = useState<{ plan: string; status: string; currentPeriodEnd?: number } | null>(null)
  const session = useMemo(() => getSession(), [])

  async function loadSubscription() {
    if (!session) return
    setLoading(true)
    setError('')
    try {
      const response = await fetchWithAuth('/v1/billing/subscription')
      const payload = await response.json() as { error?: string; subscription?: { plan: string; status: string; currentPeriodEnd?: number } }
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to load subscription')
      }
      setSubscription(payload.subscription || null)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load subscription')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadSubscription()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleCheckout(plan: 'pro' | 'enterprise') {
    setLoading(true)
    setError('')
    setStatusMessage('')
    try {
      const response = await fetchWithAuth('/v1/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })
      const payload = await response.json() as { error?: string; checkoutUrl?: string }
      if (!response.ok || !payload.checkoutUrl) {
        throw new Error(payload.error || 'Checkout failed')
      }

      window.location.href = payload.checkoutUrl
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : 'Checkout failed')
    } finally {
      setLoading(false)
    }
  }

  async function handleOpenPortal() {
    if (!session) return
    setPortalLoading(true)
    setError('')
    setStatusMessage('')
    try {
      const response = await fetchWithAuth('/v1/billing/portal', {
        method: 'POST',
      })
      const payload = await response.json() as { error?: string; portalUrl?: string }
      if (!response.ok || !payload.portalUrl) {
        throw new Error(payload.error || 'Unable to open billing portal')
      }
      window.location.href = payload.portalUrl
    } catch (portalError) {
      setError(portalError instanceof Error ? portalError.message : 'Unable to open billing portal')
    } finally {
      setPortalLoading(false)
    }
  }

  return (
    <main className="legal-shell theme-minimal theme-bg theme-text">
      <section className="legal-card billing-card">
        <header className="legal-header">
          <h1>Plans & Billing</h1>
          <p>Production-ready payment flow entry point.</p>
          <nav>
            <Link href="/">Back to app</Link>
          </nav>
        </header>

        {!session && (
          <p className="auth-warning">
            Login first from /auth to access protected billing and subscription sync.
          </p>
        )}

        {session && (
          <div className="mb-4 rounded border border-theme-primary/40 bg-theme-bg/40 p-3 text-sm">
            <p>Signed in as {session.user.email}</p>
            <p>
              Current subscription: <strong>{subscription?.plan || 'free'}</strong> ({subscription?.status || 'inactive'})
            </p>
            {subscription?.currentPeriodEnd && (
              <p>Renews until: {new Date(subscription.currentPeriodEnd).toLocaleString()}</p>
            )}
            <button type="button" className="billing-cta mt-2" onClick={() => void loadSubscription()} disabled={loading}>
              Refresh subscription state
            </button>
            <button
              type="button"
              className="billing-cta mt-2 ml-2"
              onClick={() => void handleOpenPortal()}
              disabled={portalLoading}
            >
              {portalLoading ? 'Opening portal...' : 'Manage billing portal'}
            </button>
          </div>
        )}

        <div className="billing-grid">
          {plans.map((plan) => (
            <article key={plan.name} className="billing-plan">
              <h2>{plan.name}</h2>
              <p className="billing-price">{plan.price}</p>
              <p>{plan.description}</p>
              {plan.name === 'Pro' ? (
                <button className="billing-cta" onClick={() => void handleCheckout('pro')} disabled={loading || !session}>
                  {loading ? 'Please wait...' : plan.cta}
                </button>
              ) : plan.name === 'Enterprise' ? (
                <div className="space-y-2">
                  <button className="billing-cta w-full" onClick={() => void handleCheckout('enterprise')} disabled={loading || !session}>
                    {loading ? 'Please wait...' : 'Start Enterprise Checkout'}
                  </button>
                  <a className="billing-cta block text-center" href={plan.href} target="_blank" rel="noreferrer">
                    {plan.cta}
                  </a>
                  <Link className="text-xs underline" href="/enterprise">
                    Review enterprise package details
                  </Link>
                </div>
              ) : (
                <button className="billing-cta" disabled>
                  {plan.cta}
                </button>
              )}
            </article>
          ))}
        </div>

        <section className="billing-notes mt-6">
          <h3>Pro vs Enterprise</h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] border-collapse text-sm">
              <thead>
                <tr>
                  <th className="border border-theme-primary/40 bg-theme-bg/30 p-2 text-left">Feature</th>
                  <th className="border border-theme-primary/40 bg-theme-bg/30 p-2 text-left">Pro</th>
                  <th className="border border-theme-primary/40 bg-theme-bg/30 p-2 text-left">Enterprise</th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row) => (
                  <tr key={row.feature}>
                    <td className="border border-theme-primary/30 p-2">{row.feature}</td>
                    <td className="border border-theme-primary/30 p-2">{row.pro}</td>
                    <td className="border border-theme-primary/30 p-2">{row.enterprise}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="billing-notes">
          <h3>Subscription Lifecycle</h3>
          <ul>
            <li>Upgrade: use Stripe checkout for Pro and Enterprise.</li>
            <li>Downgrade/Cancellation: use the self-serve billing portal for plan changes.</li>
            <li>Failed payment recovery: enable dunning emails in Stripe settings.</li>
            <li>Webhook sync: add Stripe webhook endpoint before launch so subscription state stays current.</li>
          </ul>
        </section>

        {statusMessage && <p className="auth-message">{statusMessage}</p>}
        {error && <p className="auth-error">{error}</p>}
      </section>
    </main>
  )
}
