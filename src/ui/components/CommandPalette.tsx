'use client'

import { useEffect, useState } from 'react'
import { useStore } from '@/store'
import type { CESMode } from '@/core/mode-router'

const COMMANDS: Array<{ id: string; label: string; action: (setTaskMode: (mode: CESMode) => void) => void }> = [
  { id: 'mode-chat', label: 'Switch to Chat Mode', action: (setTaskMode) => setTaskMode('chat') },
  { id: 'mode-build', label: 'Switch to Build Mode', action: (setTaskMode) => setTaskMode('build') },
  { id: 'mode-debug', label: 'Switch to Debug Mode', action: (setTaskMode) => setTaskMode('debug') },
  { id: 'mode-research', label: 'Switch to Research Mode', action: (setTaskMode) => setTaskMode('research') },
  { id: 'mode-decision', label: 'Switch to Decision Mode', action: (setTaskMode) => setTaskMode('decision') }
]

export function CommandPalette() {
  const { commandPaletteOpen, setCommandPaletteOpen, setTaskMode } = useStore()
  const [query, setQuery] = useState('')

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setCommandPaletteOpen(!commandPaletteOpen)
      }
      if (event.key === 'Escape') {
        setCommandPaletteOpen(false)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [commandPaletteOpen, setCommandPaletteOpen])

  if (!commandPaletteOpen) return null

  const filtered = COMMANDS.filter((command) => command.label.toLowerCase().includes(query.toLowerCase()))

  return (
    <div className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm" onClick={() => setCommandPaletteOpen(false)}>
      <div className="ces-panel mx-auto mt-24 w-full max-w-xl rounded-2xl border border-cyan-800/90 bg-[#06131d]/95 p-3" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex items-center justify-between px-1 text-[11px] uppercase tracking-[0.16em] text-cyan-300/75">
          <span>Command Palette</span>
          <span>Ctrl+K</span>
        </div>
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Type a command..."
          className="w-full rounded-lg border border-cyan-700 bg-transparent px-3 py-2 text-cyan-100 outline-none transition-all focus:border-cyan-300"
        />
        <div className="mt-2 space-y-1">
          {filtered.map((command) => (
            <button
              key={command.id}
              onClick={() => {
                command.action(setTaskMode)
                setCommandPaletteOpen(false)
                setQuery('')
              }}
              className="w-full rounded-lg px-3 py-2 text-left text-sm text-cyan-200 transition-colors hover:bg-cyan-900/60"
            >
              {command.label}
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="px-2 py-3 text-sm text-cyan-300/70">No matching commands.</p>
          )}
        </div>
        <div className="mt-2 px-1 text-[11px] text-cyan-300/65">{filtered.length} command(s)</div>
      </div>
    </div>
  )
}
