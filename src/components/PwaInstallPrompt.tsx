'use client'

import { useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

export function PwaInstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setInstallEvent(event as BeforeInstallPromptEvent)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
  }, [])

  if (!installEvent || dismissed) return null

  return (
    <div className="fixed bottom-4 right-4 z-[220] max-w-xs rounded-xl border border-cyan-500/40 bg-[#05111b]/95 p-3 text-cyan-100 shadow-xl backdrop-blur-md">
      <p className="text-sm font-semibold">Install CES App</p>
      <p className="mt-1 text-xs opacity-80">Install for offline access, fast startup, and full-screen workspace experience.</p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          className="rounded border border-cyan-400/60 px-2 py-1 text-xs hover:bg-cyan-400/10"
          onClick={async () => {
            await installEvent.prompt()
            await installEvent.userChoice
            setInstallEvent(null)
          }}
        >
          Install
        </button>
        <button
          type="button"
          className="rounded border border-cyan-700/60 px-2 py-1 text-xs hover:bg-cyan-900/35"
          onClick={() => setDismissed(true)}
        >
          Later
        </button>
      </div>
    </div>
  )
}
