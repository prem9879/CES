import Link from 'next/link'

export default function OfflinePage() {
  return (
    <main className="theme-minimal theme-bg theme-text min-h-screen flex items-center justify-center p-6">
      <section className="max-w-md rounded-xl border border-cyan-500/30 bg-[#05111b]/70 p-6 text-center">
        <h1 className="text-2xl font-bold mb-3">You are offline</h1>
        <p className="text-sm opacity-85 mb-4">
          CES cached shell is available. Reconnect to sync live models, billing, and cloud responses.
        </p>
        <Link href="/" className="inline-block rounded border border-cyan-400/60 px-4 py-2 text-sm hover:bg-cyan-400/10">
          Return to CES
        </Link>
      </section>
    </main>
  )
}
