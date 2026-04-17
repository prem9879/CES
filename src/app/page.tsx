'use client'

import { useEffect } from 'react'
import dynamic from 'next/dynamic'
import { useStore } from '@/store'
import { useEasterEggs } from '@/hooks/useEasterEggs'
import { useApiAutoDetect } from '@/hooks/useApiAutoDetect'

const CesWorkspace = dynamic(
  () => import('@/ui/layout/CesWorkspace').then((mod) => mod.CesWorkspace),
  {
    loading: () => (
      <div className="theme-bg theme-text min-h-screen flex items-center justify-center">
        <div className="theme-primary text-lg font-mono">
          <span className="loading-dots">Loading CES Workspace</span>
        </div>
      </div>
    ),
  },
)

export default function Home() {
  const {
    theme,
    isHydrated
  } = useStore()

  // Initialize easter eggs
  useEasterEggs()

  // Auto-detect self-hosted API server at same origin
  useApiAutoDetect()

  // Sync theme class to <html> so CSS variables (scrollbar colours, etc.)
  // cascade to elements outside <main>
  useEffect(() => {
    const root = document.documentElement
    root.classList.remove('theme-matrix', 'theme-hacker', 'theme-glyph', 'theme-minimal')
    root.classList.add(`theme-${theme}`)
  }, [theme])

  // Don't render until hydrated to prevent mismatch
  if (!isHydrated) {
    return (
      <div className={`theme-${theme} theme-bg min-h-screen flex items-center justify-center`}>
        <div className="theme-primary text-xl font-mono">
          <span className="loading-dots">Initializing CES</span>
        </div>
      </div>
    )
  }

  return (
    <main className={`theme-${theme} theme-bg theme-text h-screen min-h-0 relative overflow-hidden`}>
      <CesWorkspace />
    </main>
  )
}
