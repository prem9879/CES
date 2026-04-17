'use client'

import { useStore } from '@/store'
import type { CESMode } from '@/core/mode-router'

const MODES: Array<{ id: CESMode; label: string }> = [
  { id: 'chat', label: 'Chat Mode' },
  { id: 'build', label: 'Build Mode' },
  { id: 'debug', label: 'Debug Mode' },
  { id: 'research', label: 'Research Mode' },
  { id: 'decision', label: 'Decision Mode' }
]

export function ModeSelector() {
  const { taskMode, setTaskMode } = useStore()

  return (
    <div className="space-y-2">
      <p className="text-xs uppercase tracking-[0.18em] text-cyan-200/70">Execution Modes</p>
      <div className="grid gap-2">
        {MODES.map((mode) => (
          <button
            key={mode.id}
            onClick={() => setTaskMode(mode.id)}
            className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition-all duration-200 ${
              taskMode === mode.id
                ? 'border-cyan-200/90 bg-gradient-to-r from-cyan-300/20 to-emerald-300/15 text-cyan-50 shadow-[0_0_0_1px_rgba(160,246,255,0.2),0_10px_26px_-18px_rgba(120,255,202,0.8)]'
                : 'border-cyan-900/80 bg-cyan-900/20 text-cyan-200/85 hover:border-cyan-500/60 hover:bg-cyan-800/35'
            }`}
          >
            <span className="font-medium">{mode.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
