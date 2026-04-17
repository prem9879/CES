import { LegalPage } from '@/components/LegalPage'

export default function PrivacyPolicyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="April 16, 2026">
      <h2>1. Data We Process</h2>
      <p>
        We process account data you provide for authentication, operational metadata required for service health,
        and optional analytics data only when consent is granted.
      </p>

      <h2>2. Chat Data</h2>
      <p>
        Chat history is stored in your browser by default. If you use self-hosted API or dataset contribution
        features, your configuration controls what is sent server-side.
      </p>

      <h2>3. Legal Basis (EU/UK)</h2>
      <p>
        Essential storage and security logs are processed under legitimate interest. Optional analytics are processed
        under consent and can be withdrawn any time from cookie controls.
      </p>

      <h2>4. Third-Party Processors</h2>
      <p>
        Depending on your deployment, providers may include OpenRouter, Supabase, Stripe, and analytics tools.
        You are responsible for listing active processors in your production deployment documentation.
      </p>

      <h2>5. Data Retention</h2>
      <p>
        Account and billing records are retained for compliance and fraud prevention. Analytics data retention should
        be configured in your analytics provider settings.
      </p>

      <h2>6. Your Rights</h2>
      <p>
        You can request access, correction, export, and deletion where legally applicable. Contact your project support
        email shown on your deployed site for requests.
      </p>
    </LegalPage>
  )
}
