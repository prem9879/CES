import { LegalPage } from '@/components/LegalPage'

export default function TermsPage() {
  return (
    <LegalPage title="Terms & Conditions" updated="April 16, 2026">
      <h2>1. Acceptance of Terms</h2>
      <p>
        By using this service, you agree to these Terms. If you do not agree, you must stop using the service.
      </p>

      <h2>2. Account Responsibility</h2>
      <p>
        You are responsible for maintaining account confidentiality, ensuring lawful usage, and safeguarding API keys.
      </p>

      <h2>3. Acceptable Use</h2>
      <p>
        You must not use the platform for unlawful activities, abuse of third-party systems, or violation of provider
        terms. We may suspend accounts for abuse or security risks.
      </p>

      <h2>4. Billing and Subscriptions</h2>
      <p>
        Paid plans are billed by your chosen payment provider. Renewals, cancellation windows, and proration policies
        should match your active Stripe configuration.
      </p>

      <h2>5. Availability and Changes</h2>
      <p>
        The service may change, be updated, or be discontinued. We may modify features and pricing with reasonable notice.
      </p>

      <h2>6. Limitation of Liability</h2>
      <p>
        The service is provided &quot;as is&quot; without warranties to the extent permitted by law. Indirect or consequential
        damages are excluded where legally allowed.
      </p>

      <h2>7. Contact</h2>
      <p>
        You must provide a valid support/legal contact on your deployed site for user notices and legal communication.
      </p>
    </LegalPage>
  )
}
