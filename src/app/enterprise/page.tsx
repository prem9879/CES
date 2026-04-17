import Link from 'next/link'

const packageItems = [
  {
    title: 'SSO and Lifecycle',
    status: 'Planned for enterprise rollout',
    details: 'SAML and OIDC support with SCIM onboarding/deprovisioning for identity lifecycle management.',
  },
  {
    title: 'Admin Console',
    status: 'Core scope defined',
    details: 'Role-based access, workspace-level permissions, approval flows, and delegated administration.',
  },
  {
    title: 'Audit Logs',
    status: 'Design in progress',
    details: 'Immutable event history with export APIs and retention controls for compliance and forensics.',
  },
  {
    title: 'Security and Compliance',
    status: 'Available via custom package',
    details: 'Contracted controls, data-handling addendums, and enterprise-ready security questionnaire support.',
  },
  {
    title: 'Support and SLA',
    status: 'Available now',
    details: 'Priority support lane, incident escalation policy, and jointly defined uptime/response commitments.',
  },
]

export default function EnterprisePage() {
  return (
    <main className="legal-shell theme-minimal theme-bg theme-text">
      <section className="legal-card billing-card">
        <header className="legal-header">
          <h1>Enterprise Package</h1>
          <p>Explicit packaging for SSO, admin controls, auditability, and support guarantees.</p>
          <nav className="flex gap-4">
            <Link href="/billing">Back to billing</Link>
            <Link href="/">Back to app</Link>
          </nav>
        </header>

        <div className="grid gap-4 md:grid-cols-2">
          {packageItems.map((item) => (
            <article key={item.title} className="rounded border border-theme-primary/30 bg-theme-bg/40 p-4">
              <p className="text-xs uppercase tracking-wide text-theme-secondary">{item.status}</p>
              <h2 className="mt-1 text-lg font-semibold">{item.title}</h2>
              <p className="mt-2 text-sm opacity-90">{item.details}</p>
            </article>
          ))}
        </div>

        <section className="billing-notes mt-6">
          <h3>How to Start Enterprise</h3>
          <ul>
            <li>Use the Enterprise checkout path from billing for immediate provisioning.</li>
            <li>Contact sales for SSO, admin, and audit-log enablement timeline.</li>
            <li>Complete a shared launch checklist for security controls and SLA terms.</li>
          </ul>
        </section>
      </section>
    </main>
  )
}
