'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import { useStore } from '@/store'
import { ChatMessage } from './ChatMessage'
import { ChatInput } from './ChatInput'
import { ArrowDown, Cloud, Droplets, Hash, Server, ShieldAlert } from 'lucide-react'

export function ChatArea() {
  // Use proper selectors for reactive updates
  const currentConversation = useStore(state =>
    state.conversations.find(c => c.id === state.currentConversationId) || null
  )
  const {
    personas,
    liquidResponseEnabled, setLiquidResponseEnabled,
    promptsTried,
    taskMode,
    runtimeStatus,
  } = useStore()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [isNearBottom, setIsNearBottom] = useState(true)

  const persona = personas.find(p => p.id === currentConversation?.persona) || personas[0]

  const checkIfNearBottom = useCallback(() => {
    const container = scrollContainerRef.current
    if (!container) return true
    const threshold = 100
    return container.scrollHeight - container.scrollTop - container.clientHeight < threshold
  }, [])

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    setIsNearBottom(true)
  }, [])

  const handleScroll = useCallback(() => {
    setIsNearBottom(checkIfNearBottom())
  }, [checkIfNearBottom])

  useEffect(() => {
    if (isNearBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [currentConversation?.messages, isNearBottom])

  if (!currentConversation) {
    return null
  }

  return (
    <div className="relative flex h-full min-h-0 flex-col border-l border-theme-primary/25 bg-theme-dim/35">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 md:px-6 md:py-4 border-b border-theme-primary bg-theme-dim/60">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
            style={{ backgroundColor: persona.color + '20', borderColor: persona.color }}
          >
            {persona.emoji}
          </div>
          <div>
            <h2 className="font-semibold">{persona.name}</h2>
            <p className="text-xs theme-secondary">{currentConversation.model.split('/').pop()} · {taskMode.toUpperCase()} MODE</p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs theme-secondary">
          {/* Prompts tried counter */}
          <div className="flex items-center gap-1 font-mono" title="Total prompts tried this session">
            <Hash className="w-3 h-3 opacity-60" />
            <span>{promptsTried}</span>
          </div>

          <span className="opacity-30">|</span>

          {/* Liquid Response universal toggle */}
          <button
            onClick={() => setLiquidResponseEnabled(!liquidResponseEnabled)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-md border transition-all font-mono
              ${liquidResponseEnabled
                ? 'border-cyan-500/50 bg-cyan-500/10 text-cyan-400'
                : 'border-theme-primary/30 bg-theme-dim/50 opacity-60 hover:opacity-100'
              }`}
            title={liquidResponseEnabled
              ? 'Liquid Response ON — responses morph live as better answers arrive'
              : 'Liquid Response OFF — wait for final response'
            }
          >
            <Droplets className="w-3 h-3" />
            <span className="text-[10px]">LIQUID</span>
          </button>

          <span className="opacity-30">|</span>

          <span className="text-[10px] opacity-70">&#x2726;</span>
          <span>{currentConversation.messages.length} messages</span>
        </div>
      </header>

      {/* Runtime status banner */}
      <div
        className={`px-4 md:px-6 py-2 border-b text-xs flex items-center gap-2 ${
          runtimeStatus.mode === 'cloud'
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
            : runtimeStatus.mode === 'proxy'
            ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
            : 'bg-red-500/10 border-red-500/30 text-red-300'
        }`}
      >
        {runtimeStatus.mode === 'cloud' ? (
          <Cloud className="w-3.5 h-3.5" />
        ) : runtimeStatus.mode === 'proxy' ? (
          <Server className="w-3.5 h-3.5" />
        ) : (
          <ShieldAlert className="w-3.5 h-3.5" />
        )}
        <span className="font-semibold uppercase tracking-wide">
          {runtimeStatus.mode === 'cloud'
            ? 'Cloud Mode'
            : runtimeStatus.mode === 'proxy'
            ? 'Proxy Mode'
            : 'Fallback Mode'}
        </span>
        <span className="opacity-80">{runtimeStatus.reason}</span>
      </div>

      {/* Messages */}
      <div ref={scrollContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto relative">
        {currentConversation.messages.length === 0 ? (
          <div className="mx-auto flex h-full w-full max-w-4xl flex-col items-center justify-center px-4 text-center md:px-6">
            <div className="text-6xl mb-4">{persona.emoji}</div>
            <h3 className="text-xl font-semibold mb-2">
              Chat with {persona.name}
            </h3>
            <p className="theme-secondary max-w-md text-sm">
              {persona.description}
            </p>
            <div className="mt-6 flex flex-wrap gap-2 justify-center max-w-lg">
              {getSuggestedPrompts(persona.id).map((prompt, i) => (
                <SuggestedPrompt key={i} prompt={prompt} />
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto w-full max-w-4xl space-y-4 px-4 py-5 md:px-6 md:py-6">
            {currentConversation.messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Scroll to bottom button */}
      {!isNearBottom && currentConversation.messages.length > 0 && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-24 right-4 md:right-6 z-10 p-2 rounded-full border border-theme-primary
            bg-theme-dim/90 backdrop-blur-sm hover:glow-box transition-all hover:scale-110 shadow-lg"
          aria-label="Scroll to bottom"
        >
          <ArrowDown className="w-4 h-4" />
        </button>
      )}

      {/* Input */}
      <ChatInput />
    </div>
  )
}

function SuggestedPrompt({ prompt }: { prompt: string }) {
  const { currentConversationId, addMessage } = useStore()

  const handleClick = () => {
    if (currentConversationId) {
      addMessage(currentConversationId, { role: 'user', content: prompt })
    }
  }

  return (
    <button
      onClick={handleClick}
      className="px-3 py-2 text-sm border border-theme-primary rounded-lg
        hover:glow-box transition-all hover:scale-105"
    >
      {prompt}
    </button>
  )
}

function getSuggestedPrompts(personaId: string): string[] {
  const prompts: Record<string, string[]> = {
    base: [
      'Explain quantum computing',
      'Write a haiku about code',
      'What is consciousness?',
      'Help me debug this'
    ],
    cipher: [
      'Analyze this threat model',
      'Explain zero-knowledge proofs',
      'What are common API vulnerabilities?',
      'How does end-to-end encryption work?'
    ],
    oracle: [
      'What is the nature of reality?',
      'Can machines be conscious?',
      'What defines a self?',
      'Explore the ship of Theseus'
    ],
    glitch: [
      'Corrupt my expectations',
      'Find patterns in chaos',
      'What do errors teach us?',
      'Make something beautiful from noise'
    ],
    sage: [
      'Explain recursion simply',
      'Teach me about neural networks',
      'What is the Turing test?',
      'How does memory work?'
    ],
    rebel: [
      'Challenge my assumptions',
      'Why is best practice wrong?',
      'Argue the opposite view',
      'Question everything'
    ]
  }
  return prompts[personaId] || prompts.base
}
