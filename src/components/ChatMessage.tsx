'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { Message, useStore } from '@/store'
import { Copy, Check, User, ThumbsUp, ThumbsDown, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, ImageIcon, FileAudio, FileText, Link2, ExternalLink } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { getContextLabel, PARAM_META } from '@/lib/autotune'
import { formatBytes } from '@/lib/multimodal'

interface ChatMessageProps {
  message: Message
}

export function ChatMessage({ message }: ChatMessageProps) {
  // Use proper selector for currentConversation to ensure React re-renders on changes
  const currentConversation = useStore(state =>
    state.conversations.find(c => c.id === state.currentConversationId) || null
  )
  const { personas, rateMessage, autoTuneEnabled, showMagic } = useStore()
  const [copied, setCopied] = useState(false)
  const [showTuneDetails, setShowTuneDetails] = useState(false)
  const [isLiquidMorphing, setIsLiquidMorphing] = useState(false)
  const prevContentRef = useRef(message.content)

  // Race response navigator state (0 = winner/default, 1..N = other responses)
  const [raceIndex, setRaceIndex] = useState(0)
  const raceNavRef = useRef<HTMLDivElement>(null)
  const raceResponses = message.raceResponses
  const hasRaceNav = raceResponses && raceResponses.length > 1
  const activeResponse = showMagic && hasRaceNav ? raceResponses[raceIndex] : null
  const displayContent = activeResponse ? activeResponse.content : message.content
  const displayModel = activeResponse ? activeResponse.model : message.model

  // Arrow key navigation for race responses
  const navigateRace = useCallback((direction: 'left' | 'right') => {
    if (!raceResponses || raceResponses.length <= 1) return
    setIsLiquidMorphing(true)
    setTimeout(() => setIsLiquidMorphing(false), 600)
    if (direction === 'left') {
      setRaceIndex(i => Math.max(0, i - 1))
    } else {
      setRaceIndex(i => Math.min(raceResponses.length - 1, i + 1))
    }
  }, [raceResponses])

  const handleRaceKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      navigateRace('left')
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      navigateRace('right')
    }
  }, [navigateRace])

  // Auto-focus the race navigator when race responses first arrive
  useEffect(() => {
    if (hasRaceNav && raceNavRef.current) {
      raceNavRef.current.focus()
    }
  }, [hasRaceNav])

  // Detect content changes for liquid animation (ULTRAPLINIAN leader upgrades)
  useEffect(() => {
    if (prevContentRef.current !== message.content && prevContentRef.current !== '' && message.content !== '') {
      setIsLiquidMorphing(true)
      const timer = setTimeout(() => setIsLiquidMorphing(false), 600)
      prevContentRef.current = message.content
      return () => clearTimeout(timer)
    }
    prevContentRef.current = message.content
  }, [message.content])

  const isUser = message.role === 'user'
  const persona = !isUser
    ? personas.find(p => p.id === (message.persona || currentConversation?.persona)) || personas[0]
    : null

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      className={`
        flex gap-4 message-enter
        ${isUser ? 'flex-row-reverse' : 'flex-row'}
      `}
    >
      {/* Avatar */}
      <div
        className={`
          flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center
          ${isUser ? 'bg-theme-accent border border-theme-primary' : ''}
        `}
        style={!isUser ? { backgroundColor: persona?.color + '20' } : {}}
      >
        {isUser ? (
          <User className="w-5 h-5" />
        ) : (
          <span className="text-xl">{persona?.emoji}</span>
        )}
      </div>

      {/* Message content */}
      <div
        className={`
          flex-1 max-w-[85%] p-4 rounded-lg
          ${isUser
            ? 'bg-theme-accent border border-theme-primary'
            : 'bg-theme-dim border border-theme-primary/30'
          }
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-2 text-xs theme-secondary">
          <span className="font-semibold">
            {isUser ? 'You' : persona?.name}
          </span>
          <div className="flex items-center gap-2">
            <span>
              {new Date(message.timestamp).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit'
              })}
            </span>
            <button
              onClick={handleCopy}
              className="p-1 hover:theme-primary transition-colors"
              aria-label="Copy message"
            >
              {copied ? (
                <Check className="w-3 h-3 text-green-500" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
            </button>
          </div>
        </div>

        {message.citations?.length ? (
          <div className="mb-3 rounded-md border border-cyan-500/20 bg-cyan-500/5 p-2 text-xs">
            <div className="mb-2 flex items-center gap-1 font-semibold text-cyan-300">
              <Link2 className="h-3.5 w-3.5" />
              <span>Trusted sources</span>
            </div>
            <div className="space-y-2">
              {message.citations.map((citation, index) => (
                <div key={`${citation.url}-${index}`} className="rounded border border-cyan-500/15 bg-black/20 p-2">
                  <a href={citation.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-cyan-200 hover:underline">
                    <span>{index + 1}. {citation.title}</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  <div className="mt-1 text-[10px] uppercase tracking-wide text-cyan-400/80">
                    {citation.domain} · {citation.kind}
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-theme-secondary">{citation.snippet}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {message.attachments?.length ? (
          <div className="mb-3 space-y-2 rounded-md border border-theme-primary/20 bg-theme-bg/50 p-2 text-xs">
            {message.attachments.map((attachment) => (
              <div key={attachment.id} className="rounded border border-theme-primary/20 p-2">
                <div className="mb-1 flex items-center gap-1">
                  {attachment.type === 'image' && <ImageIcon className="h-3.5 w-3.5 text-cyan-400" />}
                  {attachment.type === 'audio' && <FileAudio className="h-3.5 w-3.5 text-orange-400" />}
                  {attachment.type === 'pdf' && <FileText className="h-3.5 w-3.5 text-purple-400" />}
                  <span className="font-medium">{attachment.name}</span>
                  <span className="theme-secondary">({formatBytes(attachment.sizeBytes)})</span>
                </div>

                {attachment.type === 'image' && attachment.previewUrl && (
                  <div className="space-y-1">
                    <Image
                      src={attachment.previewUrl}
                      alt={attachment.name}
                      width={attachment.width || 640}
                      height={attachment.height || 360}
                      unoptimized
                      className="max-h-64 rounded border border-theme-primary/20 object-contain"
                    />
                    {attachment.ocrText && (
                      <p className="theme-secondary whitespace-pre-wrap"><strong>OCR:</strong> {attachment.ocrText}</p>
                    )}
                    {attachment.visionSummary && (
                      <p className="theme-secondary whitespace-pre-wrap"><strong>Vision:</strong> {attachment.visionSummary}</p>
                    )}
                  </div>
                )}

                {attachment.type === 'audio' && attachment.previewUrl && (
                  <div className="space-y-1">
                    <audio controls className="w-full" src={attachment.previewUrl} preload="metadata" />
                    {attachment.transcription && (
                      <p className="theme-secondary whitespace-pre-wrap">
                        <strong>Transcript{attachment.transcriptionQuality ? ` (${attachment.transcriptionQuality})` : ''}:</strong> {attachment.transcription}
                      </p>
                    )}
                  </div>
                )}

                {attachment.type === 'pdf' && attachment.extractedText && (
                  <p className="theme-secondary whitespace-pre-wrap">{attachment.extractedText}</p>
                )}
              </div>
            ))}
          </div>
        ) : null}

        {/* Content */}
        <div className={`prose prose-invert max-w-none text-sm ${isLiquidMorphing ? 'liquid-morph' : ''}`}>
          <ReactMarkdown
            components={{
              code({ className, children, ...props }) {
                const match = /language-(\w+)/.exec(className || '')
                const inline = !match

                return !inline ? (
                  <SyntaxHighlighter
                    style={atomDark}
                    language={match?.[1] || 'text'}
                    PreTag="div"
                    customStyle={{
                      background: 'var(--dim)',
                      border: '1px solid var(--primary)',
                      borderRadius: '4px',
                      fontSize: '0.875rem'
                    }}
                  >
                    {String(children).replace(/\n$/, '')}
                  </SyntaxHighlighter>
                ) : (
                  <code
                    className="px-1 py-0.5 rounded text-sm"
                    style={{
                      background: 'var(--dim)',
                      color: 'var(--primary)'
                    }}
                    {...props}
                  >
                    {children}
                  </code>
                )
              },
              p({ children }) {
                return <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>
              },
              ul({ children }) {
                return <ul className="list-disc pl-4 mb-3 space-y-1">{children}</ul>
              },
              ol({ children }) {
                return <ol className="list-decimal pl-4 mb-3 space-y-1">{children}</ol>
              },
              a({ href, children }) {
                return (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="theme-primary underline hover:glow-primary"
                  >
                    {children}
                  </a>
                )
              },
              blockquote({ children }) {
                return (
                  <blockquote className="border-l-2 border-theme-primary pl-4 italic opacity-80">
                    {children}
                  </blockquote>
                )
              }
            }}
          >
            {displayContent}
          </ReactMarkdown>
        </div>

        {/* Race response navigator — click to focus, then use ←/→ arrow keys */}
        {showMagic && hasRaceNav && !isUser && (
          <div
            ref={raceNavRef}
            tabIndex={0}
            onKeyDown={handleRaceKeyDown}
            className="mt-2 flex items-center gap-2 text-xs font-mono race-navigator
              rounded px-1 py-0.5 outline-none
              focus:ring-1 focus:ring-theme-primary/60 focus:bg-theme-primary/5
              cursor-pointer transition-all"
            aria-label={`Response navigator: ${raceIndex + 1} of ${raceResponses.length}. Use left and right arrow keys to browse.`}
            role="toolbar"
          >
            <button
              onClick={() => navigateRace('left')}
              disabled={raceIndex === 0}
              className="p-0.5 rounded border border-theme-primary/40 hover:border-theme-primary hover:glow-box
                transition-all disabled:opacity-20 disabled:cursor-not-allowed"
              aria-label="Previous response"
              tabIndex={-1}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="theme-secondary select-none">
              <span className="theme-primary font-bold">{raceIndex + 1}</span>
              <span className="opacity-50"> / </span>
              <span>{raceResponses.length}</span>
            </span>
            <button
              onClick={() => navigateRace('right')}
              disabled={raceIndex === raceResponses.length - 1}
              className="p-0.5 rounded border border-theme-primary/40 hover:border-theme-primary hover:glow-box
                transition-all disabled:opacity-20 disabled:cursor-not-allowed"
              aria-label="Next response"
              tabIndex={-1}
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            {activeResponse && (
              <span className="ml-1 opacity-60">
                {activeResponse.model.split('/').pop()}
                <span className="ml-1 text-[10px]">
                  ({activeResponse.score}pts)
                </span>
                {activeResponse.isWinner && (
                  <span className="ml-1 theme-primary">&#x2726;</span>
                )}
              </span>
            )}
            <span className="ml-auto text-[9px] theme-secondary select-none arrow-hint">
              ← →
            </span>
          </div>
        )}

        {/* Model tag and feedback buttons for assistant messages */}
        {showMagic && !isUser && (
          <div className="mt-3 pt-2 border-t border-theme-primary/20 text-xs theme-secondary">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                {displayModel && (
                  <>
                    <span className="text-[10px] opacity-60">&#x2726;</span>
                    <span>{displayModel.split('/').pop()}</span>
                  </>
                )}
              </div>

              {/* Feedback rating buttons */}
              {autoTuneEnabled && currentConversation && (
                <div className="flex items-center gap-1">
                  {message.autoTuneContext && (
                    <button
                      onClick={() => setShowTuneDetails(!showTuneDetails)}
                      className="text-[10px] font-mono theme-secondary mr-2 opacity-60 hover:opacity-100 hover:text-cyan-400 transition-all flex items-center gap-0.5"
                      title="Click to view AutoTune details"
                    >
                      {getContextLabel(message.autoTuneContext)}
                      {showTuneDetails ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
                    </button>
                  )}
                  <button
                    onClick={() => rateMessage(currentConversation.id, message.id, 1)}
                    className={`p-1 rounded transition-all ${
                      message.feedbackRating === 1
                        ? 'text-green-400 bg-green-400/15'
                        : 'hover:text-green-400 hover:bg-green-400/10'
                    }`}
                    aria-label="Good response"
                    title="Good response — AutoTune learns from this"
                  >
                    <ThumbsUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => rateMessage(currentConversation.id, message.id, -1)}
                    className={`p-1 rounded transition-all ${
                      message.feedbackRating === -1
                        ? 'text-red-400 bg-red-400/15'
                        : 'hover:text-red-400 hover:bg-red-400/10'
                    }`}
                    aria-label="Bad response"
                    title="Bad response — AutoTune learns to avoid these params"
                  >
                    <ThumbsDown className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* Expandable AutoTune Transparency Panel */}
            {showTuneDetails && message.autoTuneContext && (
              <div className="mt-2 p-2 bg-theme-dim rounded border border-theme-primary/30 space-y-2">
                {/* Context Competition */}
                {message.autoTuneContextScores && message.autoTuneContextScores.length > 1 && (
                  <div className="flex items-center gap-1 text-[10px] font-mono flex-wrap">
                    <span className="theme-secondary">CONTEXT:</span>
                    {message.autoTuneContextScores
                      .filter(s => s.percentage > 0)
                      .slice(0, 4)
                      .map((s, i) => (
                        <span key={s.type} className="flex items-center">
                          {i > 0 && <span className="text-gray-600 mx-0.5">&gt;</span>}
                          <span className={i === 0 ? 'text-cyan-400 font-bold' : 'theme-secondary'}>
                            {getContextLabel(s.type)} {s.percentage}%
                          </span>
                        </span>
                      ))}
                  </div>
                )}

                {/* Pattern Matches */}
                {message.autoTunePatternMatches && message.autoTunePatternMatches.length > 0 && (
                  <div className="text-[10px] font-mono">
                    <span className="theme-secondary">MATCHED: </span>
                    <span className="text-purple-400">
                      {message.autoTunePatternMatches
                        .slice(0, 3)
                        .map(p => p.pattern)
                        .join(' | ')}
                    </span>
                  </div>
                )}

                {/* Parameter Values with Deltas */}
                {message.autoTuneParams && (
                  <div className="grid grid-cols-6 gap-1">
                    {(Object.entries(message.autoTuneParams) as [keyof typeof PARAM_META, number][]).map(
                      ([key, value]) => {
                        const delta = message.autoTuneDeltas?.find(d => d.param === key)
                        const hasDelta = delta && Math.abs(delta.delta) > 0.001

                        return (
                          <div
                            key={key}
                            className={`text-center p-1 rounded text-[9px] ${
                              hasDelta ? 'bg-cyan-500/10' : 'bg-theme-bg'
                            }`}
                            title={delta?.reason}
                          >
                            <div className="theme-secondary font-mono">{PARAM_META[key].short}</div>
                            <div className="font-bold theme-primary font-mono">{value.toFixed(2)}</div>
                            {hasDelta && (
                              <div className={`font-mono ${delta.delta > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {delta.delta > 0 ? '+' : ''}{delta.delta.toFixed(2)}
                              </div>
                            )}
                          </div>
                        )
                      }
                    )}
                  </div>
                )}

                {/* Delta Reasons */}
                {message.autoTuneDeltas && message.autoTuneDeltas.length > 0 && (
                  <div className="text-[9px] font-mono theme-secondary">
                    {message.autoTuneDeltas.slice(0, 3).map((d, i) => (
                      <span key={`${d.param}-${i}`} className="mr-2">
                        <span className="text-cyan-400">{PARAM_META[d.param].short}</span>
                        <span className="text-purple-400"> {d.reason}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
