'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useStore } from '@/store'
import {
  Plus,
  MessageSquare,
  Trash2,
  Settings,
  ChevronLeft,
  ChevronRight,
  Terminal,
} from 'lucide-react'
import { PersonaSelector } from './PersonaSelector'
import { ModelSelector } from './ModelSelector'
import { ModeSelector } from '@/ui/components/ModeSelector'

interface SidebarProps {
  isOpen: boolean
  onToggle: () => void
}

export function Sidebar({ isOpen, onToggle }: SidebarProps) {
  const {
    conversations,
    currentConversationId,
    createConversation,
    selectConversation,
    deleteConversation,
    setShowSettings
  } = useStore()

  const [hoveredId, setHoveredId] = useState<string | null>(null)

  const handleNewChat = () => {
    createConversation()
  }

  return (
    <>
      {/* Toggle button when closed */}
      {!isOpen && (
        <button
          onClick={onToggle}
          className="fixed left-4 top-4 z-50 p-2 bg-theme-dim border border-theme-primary rounded-lg hover:glow-box transition-all"
          aria-label="Open sidebar"
        >
          <ChevronRight className="w-5 h-5 theme-primary" />
        </button>
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed md:relative md:shrink-0 z-40 h-screen
          bg-theme-dim border-r border-theme-primary
          transition-all duration-300 ease-in-out
          ${isOpen ? 'w-72' : 'w-0'}
          overflow-hidden
        `}
      >
        <div className="flex flex-col h-full w-72">
          {/* Header */}
          <div className="p-4 border-b border-theme-primary">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-2xl relative -top-[2px]">🜏</span>
                <h1 className="text-xl font-bold theme-primary glitch glow-primary" data-text="CES">
                  CES
                </h1>
              </div>
              <button
                onClick={onToggle}
                className="p-1 hover:bg-theme-accent rounded transition-colors"
                aria-label="Close sidebar"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            </div>

            {/* New Chat Button */}
            <button
              onClick={handleNewChat}
              className="w-full flex items-center justify-center gap-2 rounded-lg border border-theme-primary px-4 py-2 transition-all hover:glow-box hacker-btn"
            >
              <Plus className="w-4 h-4" />
              <span>New Chat</span>
            </button>
          </div>

          {/* Mode, Model and Persona */}
          <div className="p-4 border-b border-theme-primary space-y-3">
            <ModeSelector />
            <ModelSelector />
            <PersonaSelector />
          </div>

          {/* Conversation List */}
          <div className="flex-1 overflow-y-auto p-2">
            {conversations.length === 0 ? (
              <div className="text-center py-8 theme-secondary text-sm">
                <Terminal className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No conversations yet</p>
                <p className="text-xs mt-1 opacity-70">Start a new chat to begin</p>
              </div>
            ) : (
              <div className="space-y-1">
                {conversations.map((conv) => (
                  <div
                    key={conv.id}
                    className={`
                      group flex items-center gap-2 p-2 rounded-lg cursor-pointer
                      transition-all duration-200
                      ${currentConversationId === conv.id
                        ? 'bg-theme-accent border border-theme-primary'
                        : 'hover:bg-theme-accent/50'
                      }
                    `}
                    onClick={() => selectConversation(conv.id)}
                    onMouseEnter={() => setHoveredId(conv.id)}
                    onMouseLeave={() => setHoveredId(null)}
                  >
                    <MessageSquare className="w-4 h-4 flex-shrink-0 theme-secondary" />
                    <span className="flex-1 truncate text-sm">
                      {conv.title}
                    </span>
                    {hoveredId === conv.id && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteConversation(conv.id)
                        }}
                        className="p-1 hover:text-red-500 transition-colors"
                        aria-label="Delete conversation"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-theme-primary">
            {/* Easter egg hints */}
            <div className="text-xs theme-secondary mb-3 text-center opacity-50">
              <span className="cursor-help" title="Try the Konami code...">
                ⌘ ↑↑↓↓←→←→BA
              </span>
            </div>

            <button
              onClick={() => setShowSettings(true)}
              className="w-full flex items-center justify-center gap-2 py-2 px-4
                border border-theme-primary rounded-lg
                hover:glow-box transition-all text-sm"
            >
              <Settings className="w-4 h-4" />
              <span>Settings</span>
            </button>

            {/* Credits */}
            <div className="mt-4 text-center">
              <p className="text-xs theme-secondary opacity-70">
                AGPL-3.0 | Forever Free
              </p>
              <p className="text-xs theme-secondary opacity-50 mt-1">
                CES
              </p>
              <div className="mt-2 text-xs opacity-75 flex gap-2 justify-center flex-wrap">
                <Link href="/architecture/" className="underline">Architecture</Link>
                <Link href="/auth/" className="underline">Auth</Link>
                <Link href="/billing/" className="underline">Billing</Link>
                <Link href="/support/" className="underline">Support</Link>
                <Link href="/admin/evidence/" className="underline">Evidence</Link>
                <Link href="/privacy-policy/" className="underline">Privacy</Link>
                <Link href="/terms/" className="underline">Terms</Link>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
