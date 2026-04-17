import { LegalPage } from '@/components/LegalPage'

export default function CookiesPolicyPage() {
  return (
    <LegalPage title="Cookies Policy" updated="April 16, 2026">
      <h2>1. What We Use</h2>
      <p>
        We use browser storage for essential app features and optional analytics identifiers when consent is given.
      </p>

      <h2>2. Cookie Categories</h2>
      <ul>
        <li>Essential: required for app functionality and security state.</li>
        <li>Analytics: optional usage insights for product improvement.</li>
      </ul>

      <h2>3. Consent Controls</h2>
      <p>
        On first visit, you can accept analytics or keep essential-only mode. You can clear stored preferences in your
        browser and set them again.
      </p>

      <h2>4. EU/EEA Users</h2>
      <p>
        Analytics scripts should only load after consent. This project enforces that behavior via consent-aware tracking.
      </p>
    </LegalPage>
  )
}
