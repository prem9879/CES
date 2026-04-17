import Link from 'next/link'

const layers = [
  {
    name: 'Experience Layer',
    title: 'Chat, build, research, and evidence surfaces',
    details: 'The app shell, onboarding, sidebar, chat canvas, billing, support, and admin evidence pages are the user-facing control plane.',
    points: ['Home workspace', 'Settings and onboarding', 'Billing and support', 'Admin evidence'],
  },
  {
    name: 'Orchestration Layer',
    title: 'Mode routing and model selection',
    details: 'Intent routing decides whether a request should go through chat, build, debug, research, or decision flow before execution starts.',
    points: ['Mode router', 'Model selector', 'Persona selector', 'Race and consortium flows'],
  },
  {
    name: 'Execution Layer',
    title: 'OpenRouter, proxy fallback, and local safeguards',
    details: 'Requests can run through OpenRouter directly or through the self-hosted API fallback when credentials are not available.',
    points: ['OpenRouter client', 'Proxy mode', 'Retry and error translation', 'Offline-ready behavior'],
  },
  {
    name: 'Trust Layer',
    title: 'Entitlements, telemetry, and evidence',
    details: 'Billing, entitlements, evidence exports, and policy pages keep the product auditable and enterprise-ready.',
    points: ['Stripe checkout', 'Entitlement checks', 'Release evidence API', 'Security and policy pages'],
  },
]

const requestFlow = [
  'User chooses an intent and mode.',
  'CES resolves the request through the mode router.',
  'The execution path selects a direct, proxy, or fallback route.',
  'Responses are rendered with race or consensus affordances when enabled.',
  'Evidence, billing, and support surfaces stay available for release and ops work.',
]

const featureMap = [
  {
    title: 'ULTRAPLINIAN race mode',
    description: 'Parallel candidates compete, the best result wins, and the user can inspect alternates with arrow navigation.',
  },
  {
    title: 'CONSORTIUM synthesis mode',
    description: 'Multiple model answers are combined into a distilled final response for higher-confidence outputs.',
  },
  {
    title: 'Proxy fallback runtime',
    description: 'When a personal key is missing, the workspace can still route through the self-hosted API layer.',
  },
  {
    title: 'Evidence and release ops',
    description: 'Admin evidence routes expose release data so shipping state is visible, not hidden in logs.',
  },
]

export default function ArchitecturePage() {
  return (
    <main className="legal-shell theme-minimal theme-bg theme-text">
      <section className="legal-card billing-card space-y-8">
        <header className="legal-header">
          <p className="text-xs uppercase tracking-[0.3em] text-theme-secondary">System architecture</p>
          <h1>CES Architecture</h1>
          <p>
            A working map of the app shell, orchestration core, execution paths, and trust surfaces that make CES more than a chat UI.
          </p>
          <nav className="flex flex-wrap gap-4">
            <Link href="/">Back to app</Link>
            <Link href="/billing">Billing</Link>
            <Link href="/admin/evidence">Evidence</Link>
          </nav>
        </header>

        <section className="grid gap-4 md:grid-cols-2">
          {layers.map((layer) => (
            <article key={layer.name} className="rounded border border-theme-primary/30 bg-theme-bg/40 p-4">
              <p className="text-xs uppercase tracking-wide text-theme-secondary">{layer.name}</p>
              <h2 className="mt-1 text-lg font-semibold">{layer.title}</h2>
              <p className="mt-2 text-sm opacity-90">{layer.details}</p>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-theme-secondary">
                {layer.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </article>
          ))}
        </section>

        <section className="rounded border border-theme-primary/30 bg-theme-bg/35 p-4 md:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-theme-secondary">Request flow</p>
              <h2 className="mt-1 text-xl font-semibold">How a request moves through CES</h2>
            </div>
            <Link href="/">Open the workspace</Link>
          </div>

          <div className="mt-5 grid gap-3">
            {requestFlow.map((step, index) => (
              <div key={step} className="flex items-start gap-3 rounded border border-theme-primary/20 bg-theme-dim/40 p-3">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-theme-primary text-sm font-semibold text-theme-primary">
                  {index + 1}
                </div>
                <p className="text-sm leading-6 opacity-90">{step}</p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-theme-secondary">Built-in features</p>
              <h2 className="mt-1 text-xl font-semibold">Real features already in the codebase</h2>
            </div>
            <Link href="/support">Support</Link>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {featureMap.map((feature) => (
              <article key={feature.title} className="rounded border border-theme-primary/30 bg-theme-bg/40 p-4">
                <h3 className="text-base font-semibold">{feature.title}</h3>
                <p className="mt-2 text-sm opacity-90">{feature.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded border border-theme-primary/30 bg-theme-bg/35 p-4 md:p-5">
          <p className="text-xs uppercase tracking-wide text-theme-secondary">Product map</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {[
              ['Home workspace', '/'],
              ['Auth', '/auth'],
              ['Billing', '/billing'],
              ['Evidence', '/admin/evidence'],
              ['Privacy', '/privacy-policy'],
              ['Terms', '/terms'],
              ['Support', '/support'],
              ['Offline', '/offline'],
            ].map(([label, href]) => (
              <Link key={label} href={href} className="rounded border border-theme-primary/20 bg-theme-dim/40 px-3 py-2 text-sm transition-colors hover:border-theme-primary">
                {label}
              </Link>
            ))}
          </div>
        </section>
      </section>
    </main>
  )
}