import Link from 'next/link'
import { ReactNode } from 'react'

interface LegalPageProps {
  title: string
  updated: string
  children: ReactNode
}

export function LegalPage({ title, updated, children }: LegalPageProps) {
  return (
    <main className="legal-shell theme-minimal theme-bg theme-text">
      <section className="legal-card">
        <header className="legal-header">
          <h1>{title}</h1>
          <p>Last updated: {updated}</p>
          <nav>
            <Link href="/">Back to app</Link>
          </nav>
        </header>
        <article className="legal-content">{children}</article>
      </section>
    </main>
  )
}
