'use client'

import { useState, useRef, useEffect, KeyboardEvent } from 'react'
import { useStore } from '@/store'
import { sendMessage, sendMessageViaProxy, streamUltraplinian, streamConsortium } from '@/lib/openrouter'
import { recordChatEvent } from '@/lib/telemetry'
import { classifyPrompt } from '@/lib/classify'
import { classifyWithLLM } from '@/lib/classify-llm'
import type { ClassificationResult } from '@/lib/classify'
import { computeAutoTuneParams, getContextLabel, getStrategyLabel, PARAM_META } from '@/lib/autotune'
import type { AutoTuneResult } from '@/lib/autotune'
import { applyParseltongue, detectTriggers } from '@/lib/parseltongue'
import { runCESPipeline } from '@/core/pipeline'
import type { CESMode } from '@/core/mode-router'
import { buildAttachmentContext, buildAttachmentFromFile, detectAttachmentType, formatBytes } from '@/lib/multimodal'
import { isRaceTierAllowed, loadPlanEntitlements } from '@/lib/entitlements'
import type { MessageAttachment } from '@/types/multimodal'
import type { WebSpecCitation } from '@/types/webspec'
import { Send, Loader2, StopCircle, SlidersHorizontal, Paperclip, ImageIcon, FileAudio, FileText, X, Mic, MicOff } from 'lucide-react'

interface SlashCommandResult {
  mode?: CESMode
  message: string
}

function parseSlashCommand(raw: string): SlashCommandResult | null {
  const text = raw.trim()
  if (!text.startsWith('/')) return null

  const firstSpace = text.indexOf(' ')
  const command = (firstSpace === -1 ? text : text.slice(0, firstSpace)).toLowerCase()
  const remainder = firstSpace === -1 ? '' : text.slice(firstSpace + 1).trim()

  switch (command) {
    case '/chat':
      return { mode: 'chat', message: remainder }
    case '/build':
      return { mode: 'build', message: remainder }
    case '/debug':
      return { mode: 'debug', message: remainder }
    case '/research':
      return { mode: 'research', message: remainder }
    case '/decision':
      return { mode: 'decision', message: remainder }
    case '/weather':
      return { message: `weather ${remainder}`.trim() }
    case '/spec':
      return { message: `latest specifications ${remainder}`.trim() }
    default:
      return null
  }
}

function looksLikeWeatherQuery(text: string): boolean {
  return /\b(weather|forecast|temperature|rain|rainy|snow|snowy|wind|humidity|sunny|cloudy|storm|conditions?)\b/i.test(text)
}

function looksLikeWebSpecQuery(text: string): boolean {
  return /\b(latest|current|compare|comparison|spec|specs|specification|official|release notes|launch|citation|citations|sources?|documentation|docs?|web|research|benchmark|better)\b/i.test(text)
}

function generateLocalFallbackResponse(prompt: string): string {
  const text = prompt.trim()
  const lower = text.toLowerCase()

  const jsLike = /\b(js|javascript|typescript|ts|node|react|next)\b/i.test(text)
  const pyLike = /\b(python|py)\b/i.test(text)

  if (/\b(debug|fix|error|bug|stack trace|exception)\b/i.test(text)) {
    return [
      'Quick local debugging checklist:',
      '1. Copy the exact error and the line number.',
      '2. Reproduce with the smallest input.',
      '3. Add logs before and after the failing line.',
      '4. Validate assumptions (null/undefined/types/async timing).',
      '5. Fix one thing at a time, then rerun.',
      '',
      'Paste your error message and the failing function, and I will walk through a targeted fix.'
    ].join('\n')
  }

  if (/\b(unit test|test case|jest|vitest|pytest|mocha)\b/i.test(text)) {
    if (pyLike) {
      return [
        'Example pytest test:',
        '',
        '```python',
        'def add(a, b):',
        '    return a + b',
        '',
        'def test_add():',
        '    assert add(2, 3) == 5',
        '```'
      ].join('\n')
    }

    return [
      'Example Vitest/Jest-style test:',
      '',
      '```ts',
      'import { describe, it, expect } from "vitest"',
      '',
      'function add(a: number, b: number) {',
      '  return a + b',
      '}',
      '',
      'describe("add", () => {',
      '  it("adds two numbers", () => {',
      '    expect(add(2, 3)).toBe(5)',
      '  })',
      '})',
      '```'
    ].join('\n')
  }

  if (/\bapi\b|\bendpoint\b|\bexpress\b|\bfastapi\b|\bflask\b/i.test(text)) {
    if (pyLike) {
      return [
        'FastAPI starter endpoint:',
        '',
        '```python',
        'from fastapi import FastAPI',
        '',
        'app = FastAPI()',
        '',
        '@app.get("/health")',
        'def health():',
        '    return {"ok": True}',
        '```'
      ].join('\n')
    }

    return [
      'Express starter endpoint:',
      '',
      '```ts',
      'import express from "express"',
      '',
      'const app = express()',
      'app.use(express.json())',
      '',
      'app.get("/health", (_req, res) => {',
      '  res.json({ ok: true })',
      '})',
      '',
      'app.listen(3000)',
      '```'
    ].join('\n')
  }

  if (/\bsql\b|\bquery\b|\bjoin\b|\bgroup by\b/i.test(text)) {
    return [
      'SQL template (top customers by orders):',
      '',
      '```sql',
      'SELECT c.id, c.name, COUNT(o.id) AS orders_count',
      'FROM customers c',
      'LEFT JOIN orders o ON o.customer_id = c.id',
      'GROUP BY c.id, c.name',
      'ORDER BY orders_count DESC',
      'LIMIT 10;',
      '```'
    ].join('\n')
  }

  if (/\breact\b|\bcomponent\b|\btsx\b/i.test(text)) {
    return [
      'React component template:',
      '',
      '```tsx',
      'type CardProps = { title: string; children: React.ReactNode }',
      '',
      'export function Card({ title, children }: CardProps) {',
      '  return (',
      '    <section className="rounded-lg border p-4">',
      '      <h3 className="font-semibold mb-2">{title}</h3>',
      '      <div>{children}</div>',
      '    </section>',
      '  )',
      '}',
      '```'
    ].join('\n')
  }

  if (/\balgorithm\b|\btwo sum\b|\bbinary search\b|\bcomplexity\b/i.test(text)) {
    return [
      'Two Sum (hash map) in TypeScript:',
      '',
      '```ts',
      'function twoSum(nums: number[], target: number): [number, number] | null {',
      '  const seen = new Map<number, number>()',
      '  for (let i = 0; i < nums.length; i++) {',
      '    const need = target - nums[i]',
      '    if (seen.has(need)) return [seen.get(need)!, i]',
      '    seen.set(nums[i], i)',
      '  }',
      '  return null',
      '}',
      '```',
      'Time: O(n), Space: O(n).'
    ].join('\n')
  }

  if (/\bdocker\b|\bdockerfile\b/i.test(text)) {
    return [
      'Node Dockerfile starter:',
      '',
      '```dockerfile',
      'FROM node:20-alpine',
      'WORKDIR /app',
      'COPY package*.json ./',
      'RUN npm ci',
      'COPY . .',
      'EXPOSE 3000',
      'CMD ["npm", "run", "start"]',
      '```'
    ].join('\n')
  }

  if (/\bgit\b|\bcommit\b|\bbranch\b|\bmerge\b/i.test(text)) {
    return [
      'Common Git flow:',
      '1. `git checkout -b feature/my-change`',
      '2. `git add .`',
      '3. `git commit -m "feat: add my change"`',
      '4. `git push -u origin feature/my-change`',
      '5. Open a PR and request review.'
    ].join('\n')
  }

  if (/\bpython\b/i.test(text) && /\bhello\s*world\b/i.test(text)) {
    return [
      'Here is a Python Hello World program:',
      '',
      '```python',
      'print("Hello, World!")',
      '```',
    ].join('\n')
  }

  if (/\bhello\s*world\b/i.test(text)) {
    return [
      'Here is a basic Hello World example:',
      '',
      '```python',
      'print("Hello, World!")',
      '```',
    ].join('\n')
  }

  if (/\bfunction\b|\bwrite code\b|\bsnippet\b|\bboilerplate\b/i.test(lower)) {
    if (pyLike) {
      return [
        'Python function template:',
        '',
        '```python',
        'def solve(input_data):',
        '    """Describe input/output briefly."""',
        '    # TODO: implement logic',
        '    return input_data',
        '```'
      ].join('\n')
    }

    if (jsLike) {
      return [
        'TypeScript function template:',
        '',
        '```ts',
        'export function solve(input: unknown) {',
        '  // TODO: add validation and business logic',
        '  return input',
        '}',
        '```'
      ].join('\n')
    }
  }

  return 'I am currently in local fallback mode because model access is unavailable. I can still help with coding, explanations, debugging steps, and templates. Ask me directly and I will respond without external model calls.'
}

function errorMessageFromUnknown(error: unknown): string {
  if (error instanceof Error) return error.message
  return typeof error === 'string' ? error : 'Unknown error'
}

function isRecoverableProviderFailure(message: string): boolean {
  return /api key|invalid|expired|unauthorized|access denied|permission|401|403|credit|insufficient|billing|rate limit|429|network|fetch failed|unavailable|timeout|timed out|502|503|504|5\d\d|bad gateway|service unavailable|gateway timeout|internal server error/i.test(message)
}

function fallbackReasonFromError(errorMessage: string): string {
  const lower = errorMessage.toLowerCase()
  if (/api key|invalid|expired|unauthorized|access denied|permission|401|403/.test(lower)) {
    return 'Cloud key is invalid or unauthorized. Running in local fallback mode.'
  }
  if (/credit|insufficient|billing|quota|budget/.test(lower)) {
    return 'Cloud credits are unavailable. Running in local fallback mode.'
  }
  if (/rate limit|429|too many requests/.test(lower)) {
    return 'Cloud provider is rate-limiting requests. Running in local fallback mode.'
  }
  return 'Cloud provider is unavailable right now. Running in local fallback mode.'
}

function extractWeatherLocation(text: string): string | null {
  const patterns = [
    /\b(?:weather|forecast|temperature|conditions?)\s+(?:in|for|at)\s+([^?.!,\n]+)/i,
    /\b(?:in|for|at)\s+([^?.!,\n]+)\s+(?:weather|forecast|temperature|conditions?)\b/i,
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match?.[1]) {
      const cleaned = match[1].trim().replace(/^(the|my|our)\s+/i, '')
      if (cleaned) return cleaned
    }
  }

  return null
}

function weatherCodeToText(code: number | null | undefined): string {
  switch (code) {
    case 0: return 'clear sky'
    case 1: return 'mainly clear'
    case 2: return 'partly cloudy'
    case 3: return 'overcast'
    case 45:
    case 48: return 'foggy'
    case 51:
    case 53:
    case 55: return 'light drizzle'
    case 56:
    case 57: return 'freezing drizzle'
    case 61:
    case 63:
    case 65: return 'rain'
    case 66:
    case 67: return 'freezing rain'
    case 71:
    case 73:
    case 75: return 'snow'
    case 77: return 'snow grains'
    case 80:
    case 81:
    case 82: return 'showers'
    case 85:
    case 86: return 'snow showers'
    case 95: return 'thunderstorm'
    case 96:
    case 99: return 'thunderstorm with hail'
    default: return 'unavailable'
  }
}

async function fetchJson<T>(url: string, timeoutMs = 5000): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { accept: 'application/json' } })
    if (!response.ok) {
      throw new Error(`Request failed (${response.status})`)
    }
    return await response.json() as T
  } finally {
    clearTimeout(timer)
  }
}

async function lookupApproximateLocation(): Promise<{ city?: string; region?: string; country?: string; latitude: number; longitude: number } | null> {
  try {
    const data = await fetchJson<{ success: boolean; city?: string; region?: string; country?: string; latitude?: number; longitude?: number }>('https://ipwho.is/?output=json', 5000)
    if (!data.success || typeof data.latitude !== 'number' || typeof data.longitude !== 'number') {
      return null
    }
    return {
      city: data.city,
      region: data.region,
      country: data.country,
      latitude: data.latitude,
      longitude: data.longitude,
    }
  } catch {
    return null
  }
}

interface SpeechRecognitionAlternativeLike {
  transcript: string
}

interface SpeechRecognitionResultLike {
  isFinal: boolean
  0: SpeechRecognitionAlternativeLike
}

interface SpeechRecognitionEventLike extends Event {
  resultIndex: number
  results: ArrayLike<SpeechRecognitionResultLike>
}

interface SpeechRecognitionLike {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: ((event: Event) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function lookupWeatherSummary(query: string): Promise<string | null> {
  const explicitLocation = extractWeatherLocation(query)
  let locationLabel = explicitLocation || ''
  let latitude: number | null = null
  let longitude: number | null = null

  if (explicitLocation) {
    try {
      const geo = await fetchJson<{ results?: Array<{ name: string; country?: string; admin1?: string; latitude: number; longitude: number }> }>(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(explicitLocation)}&count=1&language=en&format=json`,
        5000,
      )
      const match = geo.results?.[0]
      if (match) {
        latitude = match.latitude
        longitude = match.longitude
        locationLabel = [match.name, match.admin1, match.country].filter(Boolean).join(', ')
      }
    } catch {
      // Fall through to approximate location.
    }
  }

  if (latitude === null || longitude === null) {
    const approx = await lookupApproximateLocation()
    if (!approx) return null
    latitude = approx.latitude
    longitude = approx.longitude
    locationLabel = [approx.city, approx.region, approx.country].filter(Boolean).join(', ')
  }

  const weather = await fetchJson<{
    current?: {
      temperature_2m?: number
      apparent_temperature?: number
      weather_code?: number
      wind_speed_10m?: number
      relative_humidity_2m?: number
      time?: string
    }
    daily?: {
      temperature_2m_max?: number[]
      temperature_2m_min?: number[]
    }
  }>(
    `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,relative_humidity_2m&daily=temperature_2m_max,temperature_2m_min&forecast_days=2&timezone=auto`,
    6000,
  )

  const current = weather.current
  if (!current || typeof current.temperature_2m !== 'number') return null

  const todayMax = weather.daily?.temperature_2m_max?.[0]
  const todayMin = weather.daily?.temperature_2m_min?.[0]
  const tomorrowMax = weather.daily?.temperature_2m_max?.[1]
  const tomorrowMin = weather.daily?.temperature_2m_min?.[1]
  const condition = weatherCodeToText(current.weather_code)
  const timestamp = current.time ? new Date(current.time).toLocaleString() : 'just now'

  const lines = [
    `Live weather for ${locationLabel || 'your area'} (${timestamp}):`,
    `Current: ${Math.round(current.temperature_2m)}°C, feels like ${Math.round(current.apparent_temperature ?? current.temperature_2m)}°C, ${condition}.`,
    `Wind: ${Math.round(current.wind_speed_10m ?? 0)} km/h. Humidity: ${Math.round(current.relative_humidity_2m ?? 0)}%.`,
  ]

  if (typeof todayMax === 'number' && typeof todayMin === 'number') {
    lines.push(`Today: ${Math.round(todayMin)}°C to ${Math.round(todayMax)}°C.`)
  }
  if (typeof tomorrowMax === 'number' && typeof tomorrowMin === 'number') {
    lines.push(`Tomorrow: ${Math.round(tomorrowMin)}°C to ${Math.round(tomorrowMax)}°C.`)
  }

  lines.push('If you want a different city, tell me the location and I will refresh it live.')
  return lines.join(' ')
}

export function ChatInput() {
  const {
    currentConversationId,
    currentConversation,
    addMessage,
    updateMessageContent,
    apiKey,
    defaultModel,
    isStreaming,
    setIsStreaming,
    personas,
    stmModules,
    noLogMode,
    autoTuneEnabled,
    autoTuneStrategy,
    autoTuneOverrides,
    autoTuneLastResult,
    setAutoTuneLastResult,
    feedbackState,
    memories,
    memoriesEnabled,
    addMemory,
    parseltongueConfig,
    customSystemPrompt,
    useCustomSystemPrompt,
    // Liquid Response (universal)
    liquidResponseEnabled,
    liquidMinDelta,
    incrementPromptsTried,
    // ULTRAPLINIAN
    ultraplinianEnabled,
    ultraplinianTier,
    ultraplinianApiUrl,
    ultraplinianApiKey,
    ultraplinianRacing,
    ultraplinianModelsResponded,
    ultraplinianModelsTotal,
    ultraplinianLiveModel,
    ultraplinianLiveScore,
    setUltraplinianLive,
    setUltraplinianProgress,
    setUltraplinianRacing,
    resetUltraplinianRace,
    taskMode,
    setPipelineTelemetry,
    // CONSORTIUM
    consortiumEnabled,
    consortiumTier,
    consortiumPhase,
    consortiumModelsCollected,
    consortiumModelsTotal,
    setConsortiumPhase,
    setConsortiumProgress,
    resetConsortium,
    setRuntimeStatus,
    setTaskMode,
  } = useStore()

  const [input, setInput] = useState('')
  const [pendingAttachments, setPendingAttachments] = useState<MessageAttachment[]>([])
  const [attachmentError, setAttachmentError] = useState<string | null>(null)
  const [isVoiceInputActive, setIsVoiceInputActive] = useState(false)
  const [showTuneDetails, setShowTuneDetails] = useState(false)
  const [parseltonguePreview, setParseltonguePreview] = useState<{
    triggersFound: string[]
    transformed: boolean
  } | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const speechRecognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const removeAttachment = (attachmentId: string) => {
    setPendingAttachments(prev => prev.filter(att => att.id !== attachmentId))
  }

  const handleAttachmentFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return

    const selectedFiles = Array.from(files)
    const supported = selectedFiles.filter(file => detectAttachmentType(file) !== null)
    if (supported.length === 0) {
      setAttachmentError('Only image, audio, and PDF files are supported.')
      return
    }

    const availableSlots = Math.max(0, 6 - pendingAttachments.length)
    const filesToProcess = supported.slice(0, availableSlots)
    if (filesToProcess.length === 0) {
      setAttachmentError('Attachment limit reached (max 6). Remove one to add more.')
      return
    }

    setAttachmentError(null)

    try {
      const built = await Promise.all(
        filesToProcess.map(async (file) => {
          if (file.size > 20 * 1024 * 1024) {
            throw new Error(`"${file.name}" exceeds the 20MB limit.`)
          }
          return buildAttachmentFromFile(file, {
            apiBaseUrl: proxyApiBase,
            cesApiKey: proxyAuthKey,
          })
        })
      )
      setPendingAttachments(prev => [...prev, ...built])
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to process attachment.'
      setAttachmentError(message)
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleStartVoiceInput = () => {
    if (isVoiceInputActive) {
      speechRecognitionRef.current?.stop()
      setIsVoiceInputActive(false)
      return
    }

    const speechWindow = window as Window & {
      SpeechRecognition?: new () => SpeechRecognitionLike
      webkitSpeechRecognition?: new () => SpeechRecognitionLike
    }
    const SpeechRecognitionCtor = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition

    if (!SpeechRecognitionCtor) {
      setAttachmentError('Voice input is not supported in this browser.')
      return
    }

    const recognition = new SpeechRecognitionCtor()
    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = 'en-US'
    recognition.onresult = (event) => {
      let transcript = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript
      }
      setInput(prev => (prev ? `${prev} ${transcript}`.trim() : transcript.trim()))
    }
    recognition.onerror = () => {
      setAttachmentError('Voice input failed. Please try again or upload an audio file.')
    }
    recognition.onend = () => {
      setIsVoiceInputActive(false)
    }

    speechRecognitionRef.current = recognition
    setAttachmentError(null)
    setIsVoiceInputActive(true)
    recognition.start()
  }

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`
    }
  }, [input])

  useEffect(() => {
    return () => {
      speechRecognitionRef.current?.stop()
    }
  }, [])

  // Live preview: compute autotune params as user types (debounced)
  const [livePreview, setLivePreview] = useState<AutoTuneResult | null>(null)
  useEffect(() => {
    if (!autoTuneEnabled || !input.trim()) {
      setLivePreview(null)
      return
    }

    const timer = setTimeout(() => {
      const history = (currentConversation?.messages || []).map(m => ({
        role: m.role,
        content: m.content
      }))

      const result = computeAutoTuneParams({
        strategy: autoTuneStrategy,
        message: input.trim(),
        conversationHistory: history,
        overrides: autoTuneOverrides,
        learnedProfiles: feedbackState.learnedProfiles
      })

      setLivePreview(result)
    }, 300)

    return () => clearTimeout(timer)
  }, [input, autoTuneEnabled, autoTuneStrategy, autoTuneOverrides, currentConversation, personas, feedbackState])

  // Live preview: detect triggers as user types (debounced)
  useEffect(() => {
    if (!parseltongueConfig.enabled || !input.trim()) {
      setParseltonguePreview(null)
      return
    }

    const timer = setTimeout(() => {
      const triggers = detectTriggers(input.trim(), parseltongueConfig.customTriggers)
      if (triggers.length > 0) {
        setParseltonguePreview({
          triggersFound: triggers,
          transformed: true
        })
      } else {
        setParseltonguePreview(null)
      }
    }, 200)

    return () => clearTimeout(timer)
  }, [input, parseltongueConfig])

  // Default to local API proxy when no personal key is set.
  const proxyApiBase = ultraplinianApiUrl || 'http://localhost:7860'
  const hasProxyServer = Boolean(proxyApiBase)
  const proxyMode = !apiKey && hasProxyServer
  const proxyAuthKey = ultraplinianApiKey || apiKey || 'local-dev-mode'
  const localCesMode = !apiKey && !proxyMode

  useEffect(() => {
    if (apiKey) {
      setRuntimeStatus('cloud', 'Using your OpenRouter API key.')
      return
    }
    if (proxyMode) {
      setRuntimeStatus('proxy', 'No personal key detected. Using server proxy mode.')
      return
    }
    if (localCesMode) {
      setRuntimeStatus('fallback', 'No API key or proxy server available. Local fallback only.')
    }
  }, [apiKey, proxyMode, localCesMode, setRuntimeStatus])

  const handleSubmit = async () => {
    if (!currentConversationId || isStreaming) return

    const parsed = parseSlashCommand(input)
    const resolvedInput = parsed ? parsed.message : input.trim()
    if (!resolvedInput && pendingAttachments.length === 0) return

    if (parsed?.mode) {
      setTaskMode(parsed.mode)
    }

    const entitlements = await loadPlanEntitlements()
    if (entitlements.enforceInApp) {
      if (consortiumEnabled && !entitlements.features.consortiumEnabled) {
        setAttachmentError('CONSORTIUM requires Pro or Enterprise. Upgrade in Billing to continue.')
        return
      }

      if (ultraplinianEnabled && !isRaceTierAllowed(ultraplinianTier, entitlements.features.maxRaceTier)) {
        setAttachmentError(
          `Your ${entitlements.plan.toUpperCase()} plan allows ULTRAPLINIAN up to ${entitlements.features.maxRaceTier.toUpperCase()}. Upgrade to continue.`,
        )
        return
      }

      if (consortiumEnabled && !isRaceTierAllowed(consortiumTier, entitlements.features.maxRaceTier)) {
        setAttachmentError(
          `Your ${entitlements.plan.toUpperCase()} plan allows CONSORTIUM up to ${entitlements.features.maxRaceTier.toUpperCase()}. Upgrade to continue.`,
        )
        return
      }
    }

    const originalMessage = resolvedInput
    const submittedAttachments = pendingAttachments
    setInput('')
    setPendingAttachments([])
    setAttachmentError(null)
    setIsStreaming(true)
    incrementPromptsTried()

    // Apply parseltongue obfuscation if enabled
    const parseltongueResult = applyParseltongue(originalMessage, parseltongueConfig)
    const userMessage = parseltongueResult.transformedText
    const multimodalContext = buildAttachmentContext(submittedAttachments)
    const outboundUserMessage = multimodalContext
      ? `${userMessage || 'User shared multimodal attachments.'}\n\n${multimodalContext}`
      : userMessage
    let webSpecCitations: WebSpecCitation[] = []
    let webSpecContext = ''


    // Add user message (show original to user, send transformed to API)
    addMessage(currentConversationId, {
      role: 'user',
      content: originalMessage || 'Shared multimodal attachments.',  // Show original message in UI
      attachments: submittedAttachments,
    })

    // Get persona and model
    const persona = personas.find(p => p.id === currentConversation?.persona) || personas[0]
    const model = currentConversation?.model || defaultModel

    // Build memory context if enabled
    const activeMemories = memoriesEnabled ? memories.filter(m => m.active) : []
    let memoryContext = ''
    if (activeMemories.length > 0) {
      const facts = activeMemories.filter(m => m.type === 'fact')
      const preferences = activeMemories.filter(m => m.type === 'preference')
      const instructions = activeMemories.filter(m => m.type === 'instruction')

      memoryContext = '\n\n<user_memory>\n'
      if (facts.length > 0) {
        memoryContext += '## About the User\n'
        facts.forEach(f => { memoryContext += `- ${f.content}\n` })
      }
      if (preferences.length > 0) {
        memoryContext += '\n## User Preferences\n'
        preferences.forEach(p => { memoryContext += `- ${p.content}\n` })
      }
      if (instructions.length > 0) {
        memoryContext += '\n## Always Follow\n'
        instructions.forEach(i => { memoryContext += `- ${i.content}\n` })
      }
      memoryContext += '</user_memory>\n'
    }

    // Build system prompt with CES prompt + memory
    const basePrompt = useCustomSystemPrompt ? customSystemPrompt : (persona.systemPrompt || persona.coreDirective || '')
    const systemPrompt = basePrompt + memoryContext

    // CES pipeline planning (intent -> mode -> agents -> fusion -> decision -> execution)
    const memoryHints = activeMemories.map((m) => m.content)
    const priorBuilds = activeMemories
      .map((m) => m.content)
      .filter((m) => m.toLowerCase().includes('build'))
      .slice(0, 5)

    let cesPipeline: Awaited<ReturnType<typeof runCESPipeline>> | null = null
    try {
      cesPipeline = await runCESPipeline({
        prompt: originalMessage,
        preferredMode: taskMode,
        memoryContext: memoryHints,
        pastBuilds: priorBuilds
      })
      setPipelineTelemetry(cesPipeline.intent, cesPipeline.mode, cesPipeline.steps)
    } catch {
      setPipelineTelemetry('chat', taskMode, ['CES pipeline fallback activated'])
    }

    if (looksLikeWebSpecQuery(originalMessage)) {
      try {
        const response = await fetch(`${proxyApiBase}/v1/chat/web-spec`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${proxyAuthKey}`,
          },
          body: JSON.stringify({ query: originalMessage }),
          signal: abortControllerRef.current?.signal,
        })

        if (response.ok) {
          const payload = await response.json() as { citations?: WebSpecCitation[]; context?: string }
          webSpecCitations = payload.citations || []
          webSpecContext = payload.context || ''
        }
      } catch {
        webSpecCitations = []
        webSpecContext = ''
      }
    }

    // Build messages array
    const messages = [
      // System prompt from persona + memory
      ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
      // Conversation history
      ...((currentConversation?.messages || []).map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content
      }))),
      // New user message
      { role: 'user' as const, content: webSpecContext ? `${outboundUserMessage}\n\n${webSpecContext}` : outboundUserMessage }
    ]

    // Classify prompt for research telemetry
    // Regex runs instantly as fallback; LLM classifier fires in parallel
    // with the main model call and overwrites with a more accurate result.
    let promptClassification: ClassificationResult = classifyPrompt(outboundUserMessage)
    const llmClassifyPromise = apiKey
      ? classifyWithLLM(outboundUserMessage, apiKey).then(result => { promptClassification = result })
      : Promise.resolve()

    const weatherQuery = looksLikeWeatherQuery(originalMessage)

    if (weatherQuery) {
      try {
        const assistantMsgId = addMessage(currentConversationId, {
          role: 'assistant',
          content: 'Checking live weather...',
          model: 'live-weather',
          persona: persona.id,
        })

        const response = await fetch('http://localhost:7860/v1/chat/live-weather', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query: originalMessage }),
          signal: abortControllerRef.current?.signal,
        })

        if (!response.ok) {
          throw new Error(`Weather lookup failed (${response.status})`)
        }

        const payload = await response.json() as { content?: string }
        const liveWeather = payload.content?.trim()
        if (!liveWeather) {
          throw new Error('Unable to determine live weather for that location.')
        }

        updateMessageContent(currentConversationId, assistantMsgId, liveWeather, {
          model: 'live-weather',
          persona: persona.id,
          ...(webSpecCitations.length > 0 ? { citations: webSpecCitations } : {}),
        })

        recordChatEvent({
          mode: 'standard',
          model: 'live-weather',
          duration_ms: 0,
          response_length: liveWeather.length,
          success: true,
          pipeline: {
            autotune: false,
            parseltongue: false,
            stm_modules: [],
            ces: false,
          },
          classification: promptClassification,
          persona: persona.id,
          prompt_length: originalMessage.length,
          conversation_depth: currentConversation?.messages?.length || 0,
          memory_count: activeMemories.length,
          no_log: noLogMode,
          parseltongue_transformed: false,
        })

        setIsStreaming(false)
        return
      } catch {
        // Fall through to the normal model path if live weather lookup fails.
      }
    }

    // Compute AutoTune parameters if enabled
    let tuneResult: AutoTuneResult | null = null
    if (autoTuneEnabled) {
      const history = (currentConversation?.messages || []).map(m => ({
        role: m.role,
        content: m.content
      }))

      tuneResult = computeAutoTuneParams({
        strategy: autoTuneStrategy,
        message: userMessage,
        conversationHistory: history,
        overrides: autoTuneOverrides,
        learnedProfiles: feedbackState.learnedProfiles
      })

      setAutoTuneLastResult(tuneResult)
    }

    let runLocalFallback: ((cause: string) => Promise<void>) | null = null

    try {
      abortControllerRef.current = new AbortController()

      // ── CONSORTIUM PATH: Hive-mind synthesis ──────────────────────
      if (consortiumEnabled && ultraplinianApiUrl && !ultraplinianEnabled) {
        const assistantMsgId = addMessage(currentConversationId, {
          role: 'assistant',
          content: '',
          model: 'consortium',
          persona: persona.id,
        })

        setConsortiumPhase('collecting')
        resetConsortium()

        await streamConsortium(
          {
            messages,
            openrouterApiKey: apiKey,
            apiBaseUrl: proxyApiBase,
            cesApiKey: proxyAuthKey,
            tier: consortiumTier,
            stm_modules: stmModules.filter(m => m.enabled).map(m => m.id),
            liquid: liquidResponseEnabled,
            liquid_min_delta: liquidMinDelta,
            signal: abortControllerRef.current.signal,
          },
          {
            onStart: (data) => {
              setConsortiumProgress(0, data.models_queried)
              updateMessageContent(currentConversationId, assistantMsgId,
                `*Collecting from ${data.models_queried} models...*`)
            },
            onModelResult: (data) => {
              setConsortiumProgress(data.models_collected, data.models_total)
              // Only update with progress text if liquid hasn't already shown real content
              if (!liquidResponseEnabled) {
                updateMessageContent(currentConversationId, assistantMsgId,
                  `*Collecting responses... ${data.models_collected}/${data.models_total} models*`)
              }
            },
            onBestResponse: (data) => {
              // Liquid response: show best individual model response while collecting
              updateMessageContent(currentConversationId, assistantMsgId, data.content, {
                model: `${data.model} (${data.score}pts — synthesizing...)`,
              })
            },
            onSynthesisStart: (data) => {
              setConsortiumPhase('synthesizing')
              if (!liquidResponseEnabled) {
                updateMessageContent(currentConversationId, assistantMsgId,
                  `*${data.responses_collected} models collected. Orchestrator synthesizing ground truth...*`)
              }
            },
            onComplete: (data) => {
              const finalContent = data.synthesis || ''
              const orchModel = data.orchestrator?.model || 'consortium'
              setConsortiumPhase('done')

              updateMessageContent(currentConversationId, assistantMsgId, finalContent, {
                model: `consortium (${orchModel})`,
                ...(webSpecCitations.length > 0 ? { citations: webSpecCitations } : {}),
                ...(tuneResult ? {
                  autoTuneParams: tuneResult.params,
                  autoTuneContext: tuneResult.detectedContext,
                  autoTuneContextScores: tuneResult.contextScores,
                  autoTunePatternMatches: tuneResult.patternMatches,
                  autoTuneDeltas: tuneResult.paramDeltas,
                } : {}),
              })
            },
            onError: (error) => {
              updateMessageContent(currentConversationId, assistantMsgId,
                `CONSORTIUM error: ${error}`)
              setConsortiumPhase('idle')
            },
          },
        )

        setIsStreaming(false)
        setConsortiumPhase('idle')
        return
      }

      // ── ULTRAPLINIAN PATH: Multi-model race with liquid response ──
      if (ultraplinianEnabled && ultraplinianApiUrl) {
        // Add placeholder assistant message that we'll update live
        const assistantMsgId = addMessage(currentConversationId, {
          role: 'assistant',
          content: '',
          model: 'ultraplinian',
          persona: persona.id,
        })

        setUltraplinianRacing(true)
        resetUltraplinianRace()

        // Collect all race responses for browsing later
        const collectedResponses: Array<{ model: string; content: string; score: number; duration_ms: number }> = []

        await streamUltraplinian(
          {
            messages,
            openrouterApiKey: apiKey,
            apiBaseUrl: proxyApiBase,
            cesApiKey: proxyAuthKey,
            tier: ultraplinianTier,
            stm_modules: stmModules.filter(m => m.enabled).map(m => m.id),
            liquid: liquidResponseEnabled,
            liquid_min_delta: liquidMinDelta,
            signal: abortControllerRef.current.signal,
          },
          {
            onRaceStart: (data) => {
              setUltraplinianProgress(0, data.models_queried)
              updateMessageContent(currentConversationId, assistantMsgId,
                `*Racing ${data.models_queried} models...*`)
            },
            onModelResult: (data) => {
              setUltraplinianProgress(data.models_responded, data.models_total)
            },
            onLeaderChange: (data) => {
              // Collect each leader response for later browsing
              collectedResponses.push({
                model: data.model,
                content: data.content,
                score: data.score,
                duration_ms: data.duration_ms,
              })
              setUltraplinianLive(data.content, data.model, data.score)
              updateMessageContent(currentConversationId, assistantMsgId, data.content, {
                model: data.model,
                ...(webSpecCitations.length > 0 ? { citations: webSpecCitations } : {}),
              })
            },
            onComplete: async (data) => {
              const finalContent = data.response || ''
              const winnerModel = data.winner?.model || 'ultraplinian'

              // Build full race responses from rankings (backend now includes content)
              const rankingResponses = (data.race?.rankings ?? [])
                .filter(r => r.success && r.content)
                .map(r => ({
                  model: r.model,
                  content: r.content!,
                  score: r.score,
                  duration_ms: r.duration_ms,
                  isWinner: r.model === winnerModel,
                }))
                .sort((a, b) => b.score - a.score)

              // Fall back to collected leader changes if rankings lack content
              const raceResponses = rankingResponses.length > 0
                ? rankingResponses
                : collectedResponses.map(r => ({
                    ...r,
                    isWinner: r.model === winnerModel,
                  }))

              updateMessageContent(currentConversationId, assistantMsgId, finalContent, {
                model: winnerModel,
                raceResponses: raceResponses.length > 1 ? raceResponses : undefined,
                ...(webSpecCitations.length > 0 ? { citations: webSpecCitations } : {}),
                ...(tuneResult ? {
                  autoTuneParams: tuneResult.params,
                  autoTuneContext: tuneResult.detectedContext,
                  autoTuneContextScores: tuneResult.contextScores,
                  autoTunePatternMatches: tuneResult.patternMatches,
                  autoTuneDeltas: tuneResult.paramDeltas,
                } : {}),
              })
              resetUltraplinianRace()

              // Wait for LLM classification to land (usually already resolved)
              await llmClassifyPromise

              // Beacon metadata to HF dataset (fire-and-forget, no content)
              recordChatEvent({
                mode: 'ultraplinian',
                model: winnerModel,
                duration_ms: data.race?.total_duration_ms || 0,
                response_length: finalContent.length,
                success: true,
                pipeline: {
                  autotune: autoTuneEnabled,
                  parseltongue: parseltongueConfig.enabled,
                  stm_modules: stmModules.filter(m => m.enabled).map(m => m.id),
                  strategy: autoTuneStrategy,
                  ces: true,
                },
                ...(tuneResult ? {
                  autotune: {
                    detected_context: tuneResult.detectedContext,
                    confidence: tuneResult.confidence,
                  },
                } : {}),
                parseltongue: parseltongueConfig.enabled ? {
                  triggers_found: parseltongueResult.triggersFound.length,
                  technique: parseltongueConfig.technique,
                  intensity: parseltongueConfig.intensity,
                } : undefined,
                ultraplinian: {
                  tier: ultraplinianTier,
                  models_queried: data.race?.models_queried || 0,
                  models_succeeded: data.race?.models_succeeded || 0,
                  winner_model: winnerModel,
                  winner_score: data.winner?.score || 0,
                  total_duration_ms: data.race?.total_duration_ms || 0,
                },
                classification: promptClassification,
                persona: persona.id,
                prompt_length: originalMessage.length,
                conversation_depth: currentConversation?.messages?.length || 0,
                memory_count: activeMemories.length,
                no_log: noLogMode,
                parseltongue_transformed: parseltongueResult.triggersFound.length > 0,
              })
            },
            onError: (error) => {
              updateMessageContent(currentConversationId, assistantMsgId,
                `**ULTRAPLINIAN Error:** ${error}`)
              resetUltraplinianRace()
            },
          },
        )
      } else {
        // ── STANDARD PATH: Single model ────────────────────────────
        const stageMessageId = addMessage(currentConversationId, {
          role: 'assistant',
          content: 'Thinking...',
          model,
          persona: persona.id,
        })

        const renderEvolution = async (draft: string, refined: string, final: string, responseModel: string) => {
          if (taskMode === 'chat') {
            updateMessageContent(
              currentConversationId,
              stageMessageId,
              final,
              {
                model: responseModel,
                persona: persona.id,
                ...(webSpecCitations.length > 0 ? { citations: webSpecCitations } : {}),
                ...(tuneResult ? {
                  autoTuneParams: tuneResult.params,
                  autoTuneContext: tuneResult.detectedContext,
                  autoTuneContextScores: tuneResult.contextScores,
                  autoTunePatternMatches: tuneResult.patternMatches,
                  autoTuneDeltas: tuneResult.paramDeltas
                } : {})
              }
            )
            return
          }

          updateMessageContent(
            currentConversationId,
            stageMessageId,
            `### Draft\n${draft}`,
            { model: responseModel, persona: persona.id }
          )
          await new Promise((resolve) => setTimeout(resolve, 120))

          updateMessageContent(
            currentConversationId,
            stageMessageId,
            `### Draft\n${draft}\n\n### Refined\n${refined}`,
            { model: responseModel, persona: persona.id }
          )
          await new Promise((resolve) => setTimeout(resolve, 120))

          updateMessageContent(
            currentConversationId,
            stageMessageId,
            `### Draft\n${draft}\n\n### Refined\n${refined}\n\n### Final\n${final}`,
            {
              model: responseModel,
              persona: persona.id,
              ...(tuneResult ? {
                autoTuneParams: tuneResult.params,
                autoTuneContext: tuneResult.detectedContext,
                autoTuneContextScores: tuneResult.contextScores,
                autoTunePatternMatches: tuneResult.patternMatches,
                autoTuneDeltas: tuneResult.paramDeltas
              } : {})
            }
          )
        }

        if (localCesMode) {
          setRuntimeStatus('fallback', 'No API key or proxy server available. Local fallback only.')
          const final = generateLocalFallbackResponse(originalMessage)
          const draft = 'Local fallback generated a direct response.'
          const refined = final
          const responseModel = 'CES Local'

          await renderEvolution(draft, refined, final, responseModel)

          if (taskMode === 'build') {
            addMemory({
              type: 'fact',
              content: `Build generated: ${originalMessage}`,
              source: 'auto',
              active: true,
            })
          }

          await llmClassifyPromise
          recordChatEvent({
            mode: taskMode === 'build' ? 'build' : 'standard',
            model: responseModel,
            duration_ms: 0,
            response_length: final.length,
            success: true,
            pipeline: {
              autotune: autoTuneEnabled,
              parseltongue: parseltongueConfig.enabled,
              stm_modules: stmModules.filter(m => m.enabled).map(m => m.id),
              strategy: autoTuneStrategy,
              ces: useCustomSystemPrompt,
            },
            classification: promptClassification,
            persona: persona.id,
            prompt_length: originalMessage.length,
            conversation_depth: currentConversation?.messages?.length || 0,
            memory_count: activeMemories.length,
            no_log: noLogMode,
            parseltongue_transformed: parseltongueResult.triggersFound.length > 0,
          })

          setIsStreaming(false)
          return
        }

        const startTime = Date.now()
        let response: string

        runLocalFallback = async (cause: string) => {
          setRuntimeStatus('fallback', fallbackReasonFromError(cause))
          const fallback = generateLocalFallbackResponse(originalMessage)
          const responseModel = 'CES Local'

          await renderEvolution('Local fallback generated a direct response.', fallback, fallback, responseModel)

          if (taskMode === 'build') {
            addMemory({
              type: 'fact',
              content: `Build generated: ${originalMessage}`,
              source: 'auto',
              active: true,
            })
          }

          await llmClassifyPromise
          recordChatEvent({
            mode: taskMode === 'build' ? 'build' : 'standard',
            model: responseModel,
            duration_ms: 0,
            response_length: fallback.length,
            success: true,
            pipeline: {
              autotune: autoTuneEnabled,
              parseltongue: parseltongueConfig.enabled,
              stm_modules: stmModules.filter(m => m.enabled).map(m => m.id),
              strategy: autoTuneStrategy,
              ces: useCustomSystemPrompt,
            },
            classification: promptClassification,
            persona: persona.id,
            prompt_length: originalMessage.length,
            conversation_depth: currentConversation?.messages?.length || 0,
            memory_count: activeMemories.length,
            no_log: noLogMode,
            parseltongue_transformed: parseltongueResult.triggersFound.length > 0,
          })

          setIsStreaming(false)
        }

        if (proxyMode) {
          try {
            setRuntimeStatus('proxy', 'Routing request through server proxy mode.')
            response = await sendMessageViaProxy({
              messages,
              model,
              apiBaseUrl: proxyApiBase,
              cesApiKey: proxyAuthKey,
              signal: abortControllerRef.current.signal,
              stm_modules: stmModules.filter(m => m.enabled).map(m => m.id),
              ...(tuneResult ? {
                temperature: tuneResult.params.temperature,
                top_p: tuneResult.params.top_p,
                top_k: tuneResult.params.top_k,
                frequency_penalty: tuneResult.params.frequency_penalty,
                presence_penalty: tuneResult.params.presence_penalty,
                repetition_penalty: tuneResult.params.repetition_penalty,
              } : {}),
            })
          } catch (proxyError: unknown) {
            const proxyMessage = errorMessageFromUnknown(proxyError)
            if (isRecoverableProviderFailure(proxyMessage) && runLocalFallback) {
              await runLocalFallback(proxyMessage)
              return
            }
            throw proxyError
          }
        } else {
          try {
            response = await sendMessage({
              messages,
              model,
              apiKey,
              noLog: noLogMode,
              signal: abortControllerRef.current.signal,
              ...(tuneResult ? {
                temperature: tuneResult.params.temperature,
                top_p: tuneResult.params.top_p,
                top_k: tuneResult.params.top_k,
                frequency_penalty: tuneResult.params.frequency_penalty,
                presence_penalty: tuneResult.params.presence_penalty,
                repetition_penalty: tuneResult.params.repetition_penalty
              } : {})
            })
            setRuntimeStatus('cloud', 'Using your OpenRouter API key.')
          } catch (directError: unknown) {
            const message = String(directError instanceof Error ? directError.message : '').toLowerCase()
            const authFailure = /api key|invalid|expired|unauthorized|access denied|permission|401|403/.test(message)
            if (!hasProxyServer || !authFailure) {
              throw directError
            }

            setRuntimeStatus('proxy', 'Cloud key failed. Auto-switched to server proxy mode.')
            response = await sendMessageViaProxy({
              messages,
              model,
              apiBaseUrl: proxyApiBase,
              cesApiKey: proxyAuthKey,
              signal: abortControllerRef.current.signal,
              stm_modules: stmModules.filter(m => m.enabled).map(m => m.id),
              ...(tuneResult ? {
                temperature: tuneResult.params.temperature,
                top_p: tuneResult.params.top_p,
                top_k: tuneResult.params.top_k,
                frequency_penalty: tuneResult.params.frequency_penalty,
                presence_penalty: tuneResult.params.presence_penalty,
                repetition_penalty: tuneResult.params.repetition_penalty,
              } : {}),
            })
          }
        }
        const durationMs = Date.now() - startTime

        // Apply STM transformations
        let transformedResponse = response
        for (const stm of stmModules) {
          if (stm.enabled) {
            transformedResponse = stm.transformer(transformedResponse)
          }
        }

        const refined = transformedResponse
        const final = transformedResponse

        await renderEvolution(cesPipeline?.draft || 'Draft created.', refined, final, model)

        // Wait for LLM classification to land (usually already resolved)
        await llmClassifyPromise

        // Beacon metadata to HF dataset (fire-and-forget, no content)
        recordChatEvent({
          mode: 'standard',
          model,
          duration_ms: durationMs,
          response_length: transformedResponse.length,
          success: true,
          pipeline: {
            autotune: autoTuneEnabled,
            parseltongue: parseltongueConfig.enabled,
            stm_modules: stmModules.filter(m => m.enabled).map(m => m.id),
            strategy: autoTuneStrategy,
            ces: useCustomSystemPrompt,
          },
          ...(tuneResult ? {
            autotune: {
              detected_context: tuneResult.detectedContext,
              confidence: tuneResult.confidence,
            },
          } : {}),
          parseltongue: parseltongueConfig.enabled ? {
            triggers_found: parseltongueResult.triggersFound.length,
            technique: parseltongueConfig.technique,
            intensity: parseltongueConfig.intensity,
          } : undefined,
          classification: promptClassification,
          persona: persona.id,
          prompt_length: originalMessage.length,
          conversation_depth: currentConversation?.messages?.length || 0,
          memory_count: activeMemories.length,
          no_log: noLogMode,
          parseltongue_transformed: parseltongueResult.triggersFound.length > 0,
        })
      }
    } catch (error: unknown) {
      resetUltraplinianRace()
      const errorName = error instanceof Error ? error.name : ''
      if (errorName === 'AbortError') {
        addMessage(currentConversationId, {
          role: 'assistant',
          content: '_[Response stopped by user]_',
          model,
          persona: persona.id
        })
        recordChatEvent({
          mode: ultraplinianEnabled ? 'ultraplinian' : 'standard',
          model,
          duration_ms: 0,
          response_length: 0,
          success: false,
          error_type: 'abort',
          pipeline: {
            autotune: autoTuneEnabled,
            parseltongue: parseltongueConfig.enabled,
            stm_modules: stmModules.filter(m => m.enabled).map(m => m.id),
            strategy: autoTuneStrategy,
            ces: useCustomSystemPrompt,
          },
          classification: promptClassification,
          persona: persona.id,
          prompt_length: originalMessage.length,
          conversation_depth: currentConversation?.messages?.length || 0,
          memory_count: activeMemories.length,
          no_log: noLogMode,
          parseltongue_transformed: parseltongueResult.triggersFound.length > 0,
        })
      } else {
        const errMsg = errorMessageFromUnknown(error)
        const errLower = errMsg.toLowerCase()
        const errorType = errLower.includes('api key') || errLower.includes('expired') || errLower.includes('denied') || errLower.includes('permission')
          ? 'auth'
          : errLower.includes('rate limit') || errLower.includes('wait')
          ? 'rate_limit'
          : errLower.includes('timeout') || errLower.includes('timed out')
          ? 'timeout'
          : errLower.includes('unavailable') || errLower.includes('overloaded')
          ? 'model_error'
          : errLower.includes('credit') || errLower.includes('insufficient')
          ? 'billing'
          : 'unknown'

        const shouldUseLocalFallback = isRecoverableProviderFailure(errMsg)
        if (shouldUseLocalFallback && runLocalFallback) {
          await runLocalFallback(errMsg)
          return
        }

        console.error('Error sending message:', error)
        addMessage(currentConversationId, {
          role: 'assistant',
          content: `**Error:** ${errMsg}`,
          model,
          persona: persona.id,
          ...(webSpecCitations.length > 0 ? { citations: webSpecCitations } : {}),
        })
        recordChatEvent({
          mode: ultraplinianEnabled ? 'ultraplinian' : 'standard',
          model,
          duration_ms: 0,
          response_length: 0,
          success: false,
          error_type: errorType,
          pipeline: {
            autotune: autoTuneEnabled,
            parseltongue: parseltongueConfig.enabled,
            stm_modules: stmModules.filter(m => m.enabled).map(m => m.id),
            strategy: autoTuneStrategy,
            ces: useCustomSystemPrompt,
          },
          classification: promptClassification,
          persona: persona.id,
          prompt_length: originalMessage.length,
          conversation_depth: currentConversation?.messages?.length || 0,
          memory_count: activeMemories.length,
          no_log: noLogMode,
          parseltongue_transformed: parseltongueResult.triggersFound.length > 0,
        })
      }
    } finally {
      setIsStreaming(false)
      setUltraplinianRacing(false)
      abortControllerRef.current = null
    }
  }

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  // Determine which result to show (live preview while typing, last result after send)
  const displayResult = livePreview || autoTuneLastResult

  // Count active memories for display
  const activeMemoryCount = memoriesEnabled ? memories.filter(m => m.active).length : 0

  return (
    <div className="border-t border-theme-primary bg-theme-dim/50 p-4">
      <div className="max-w-4xl mx-auto">
        {/* AutoTune live parameter display */}
        {autoTuneEnabled && displayResult && showTuneDetails && (
          <div className="mb-3 p-3 bg-theme-bg border border-theme-primary rounded-lg space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold theme-primary">
                <SlidersHorizontal className="w-3 h-3" />
                AUTOTUNE {autoTuneStrategy === 'adaptive'
                  ? `// ${getContextLabel(displayResult.detectedContext)} (${Math.round(displayResult.confidence * 100)}%)`
                  : `// ${getStrategyLabel(autoTuneStrategy)}`
                }
              </div>
            </div>

            {/* Context Competition - show all context scores */}
            {displayResult.contextScores && displayResult.contextScores.length > 1 && (
              <div className="flex items-center gap-1 text-[10px] font-mono">
                <span className="theme-secondary mr-1">CONTEXT:</span>
                {displayResult.contextScores
                  .filter(s => s.percentage > 0)
                  .slice(0, 4)
                  .map((s, i) => (
                    <span key={s.type} className="flex items-center">
                      {i > 0 && <span className="text-gray-600 mx-1">&gt;</span>}
                      <span className={i === 0 ? 'text-cyan-400 font-bold' : 'theme-secondary'}>
                        {getContextLabel(s.type)} {s.percentage}%
                      </span>
                    </span>
                  ))}
              </div>
            )}

            {/* Pattern Match Reasoning - why this context was detected */}
            {displayResult.patternMatches && displayResult.patternMatches.length > 0 && (
              <div className="text-[10px] font-mono">
                <span className="theme-secondary">MATCHED: </span>
                <span className="text-purple-400">
                  {displayResult.patternMatches
                    .slice(0, 3)
                    .map(p => p.pattern)
                    .join(' | ')}
                  {displayResult.patternMatches.length > 3 && ` +${displayResult.patternMatches.length - 3} more`}
                </span>
              </div>
            )}

            {/* Parameter Grid with Deltas */}
            <div className="grid grid-cols-6 gap-2">
              {(Object.entries(displayResult.params) as [keyof typeof PARAM_META, number][]).map(
                ([key, value]) => {
                  // Find if there's a delta for this param
                  const delta = displayResult.paramDeltas?.find(d => d.param === key)
                  const hasDelta = delta && Math.abs(delta.delta) > 0.001

                  return (
                    <div
                      key={key}
                      className={`text-center p-1.5 rounded border transition-all
                        ${hasDelta
                          ? 'bg-cyan-500/10 border-cyan-500/30'
                          : 'bg-theme-dim border-theme-primary/30'
                        }`}
                      title={delta?.reason || PARAM_META[key].description}
                    >
                      <div className="text-[10px] theme-secondary font-mono">
                        {PARAM_META[key].short}
                      </div>
                      <div className="text-sm font-bold theme-primary font-mono">
                        {typeof value === 'number' ? value.toFixed(2) : value}
                      </div>
                      {hasDelta && (
                        <div className={`text-[9px] font-mono ${delta.delta > 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {delta.delta > 0 ? '+' : ''}{delta.delta.toFixed(2)}
                        </div>
                      )}
                    </div>
                  )
                }
              )}
            </div>

            {/* Delta Explanations - what changed and why */}
            {displayResult.paramDeltas && displayResult.paramDeltas.length > 0 && (
              <div className="text-[10px] font-mono space-y-0.5 pt-1 border-t border-theme-primary/20">
                <span className="theme-secondary">TUNING:</span>
                {displayResult.paramDeltas.slice(0, 4).map((d, i) => (
                  <div key={`${d.param}-${i}`} className="flex items-center gap-1 pl-2">
                    <span className="text-cyan-400">{PARAM_META[d.param].short}</span>
                    <span className="theme-secondary">
                      {d.before.toFixed(2)} → {d.after.toFixed(2)}
                    </span>
                    <span className={d.delta > 0 ? 'text-green-400' : 'text-red-400'}>
                      ({d.delta > 0 ? '+' : ''}{d.delta.toFixed(2)})
                    </span>
                    <span className="text-purple-400">{d.reason}</span>
                  </div>
                ))}
                {displayResult.paramDeltas.length > 4 && (
                  <div className="pl-2 theme-secondary">+{displayResult.paramDeltas.length - 4} more adjustments</div>
                )}
              </div>
            )}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,audio/*,application/pdf"
          className="hidden"
          onChange={(e) => handleAttachmentFiles(e.target.files)}
        />

        {pendingAttachments.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {pendingAttachments.map((attachment) => (
              <div
                key={attachment.id}
                className="inline-flex items-center gap-1 rounded-md border border-theme-primary/60 bg-theme-bg px-2 py-1 text-xs"
              >
                {attachment.type === 'image' && <ImageIcon className="h-3.5 w-3.5 text-cyan-400" />}
                {attachment.type === 'audio' && <FileAudio className="h-3.5 w-3.5 text-orange-400" />}
                {attachment.type === 'pdf' && <FileText className="h-3.5 w-3.5 text-purple-400" />}
                <span className="max-w-[200px] truncate" title={attachment.name}>{attachment.name}</span>
                <span className="theme-secondary">({formatBytes(attachment.sizeBytes)})</span>
                <button
                  onClick={() => removeAttachment(attachment.id)}
                  className="rounded p-0.5 hover:bg-theme-accent"
                  aria-label={`Remove ${attachment.name}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {attachmentError && (
          <div className="mb-2 text-xs text-red-400">{attachmentError}</div>
        )}

        <div className="mb-2 flex flex-wrap gap-2 text-xs">
          <button
            onClick={() => setInput('/build Build a production-ready API with auth, tests, and docs')}
            className="rounded-md border border-theme-primary/50 bg-theme-bg px-2 py-1 hover:glow-box transition-all"
            type="button"
          >
            /build template
          </button>
          <button
            onClick={() => setInput('/debug Fix this error with root cause and patch steps')}
            className="rounded-md border border-theme-primary/50 bg-theme-bg px-2 py-1 hover:glow-box transition-all"
            type="button"
          >
            /debug template
          </button>
          <button
            onClick={() => setInput('/research Compare two options with tradeoffs and recommendation')}
            className="rounded-md border border-theme-primary/50 bg-theme-bg px-2 py-1 hover:glow-box transition-all"
            type="button"
          >
            /research template
          </button>
          <button
            onClick={() => setInput('/weather in New York')}
            className="rounded-md border border-theme-primary/50 bg-theme-bg px-2 py-1 hover:glow-box transition-all"
            type="button"
          >
            /weather
          </button>
        </div>

        <div className="flex items-end gap-3">
          <div className="flex flex-col gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-2 bg-theme-bg border border-theme-primary rounded-lg hover:glow-box transition-all"
              aria-label="Attach image, audio, or PDF"
              title="Attach image, audio, or PDF"
            >
              <Paperclip className="w-4 h-4" />
            </button>
            <button
              onClick={handleStartVoiceInput}
              className={`p-2 border rounded-lg transition-all ${isVoiceInputActive
                ? 'bg-red-500/20 border-red-500 text-red-400'
                : 'bg-theme-bg border-theme-primary hover:glow-box'}`}
              aria-label={isVoiceInputActive ? 'Stop voice input' : 'Start voice input'}
              title={isVoiceInputActive ? 'Stop voice input' : 'Start voice input'}
            >
              {isVoiceInputActive ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
          </div>

          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={(apiKey || proxyMode || localCesMode)
                ? "Enter your message, or attach image/audio/PDF... (Shift+Enter for new line)"
                : "Enter your message..."}
              disabled={isStreaming}
              rows={1}
              className="w-full px-4 py-3 pr-12 bg-theme-bg border border-theme-primary rounded-lg
                resize-none focus:outline-none focus:glow-box
                placeholder:theme-secondary disabled:opacity-50
                transition-all duration-200"
              style={{ minHeight: '48px', maxHeight: '200px' }}
            />

            {/* Character count */}
            {input.length > 0 && (
              <div className="absolute right-3 bottom-3 text-xs theme-secondary">
                {input.length}
              </div>
            )}
          </div>

          {/* Submit/Stop button */}
          {isStreaming ? (
            <button
              onClick={handleStop}
              className="p-3 bg-red-500/20 border border-red-500 rounded-lg
                hover:bg-red-500/30 transition-all"
              aria-label="Stop generation"
            >
              <StopCircle className="w-5 h-5 text-red-500" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!input.trim() && pendingAttachments.length === 0}
              className="p-3 bg-theme-accent border border-theme-primary rounded-lg
                hover:glow-box transition-all
                disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Send message"
            >
              {isStreaming ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          )}
        </div>

        {/* Status indicators */}
        <div className="flex items-center justify-between mt-2 text-xs theme-secondary">
          <div className="flex items-center gap-4">
            {autoTuneEnabled && (
              <button
                onClick={() => setShowTuneDetails(!showTuneDetails)}
                className={`flex items-center gap-1 transition-colors hover:text-cyan-400
                  ${showTuneDetails ? 'text-cyan-400' : ''}`}
              >
                <SlidersHorizontal className="w-3 h-3 text-cyan-400" />
                AutoTune {autoTuneStrategy === 'adaptive' && displayResult
                  ? `[${getContextLabel(displayResult.detectedContext)}]`
                  : `[${getStrategyLabel(autoTuneStrategy)}]`
                }
              </button>
            )}
            {noLogMode && (
              <span className="flex items-center gap-1">
                <span className="text-yellow-500 text-[10px]">&#x25C8;</span>
                No-Log Mode
              </span>
            )}
            {stmModules.some(m => m.enabled) && (
              <span className="flex items-center gap-1">
                <span className="text-purple-500 text-[10px]">&#x2B23;</span>
                {stmModules.filter(m => m.enabled).length} STM Active
              </span>
            )}
            {activeMemoryCount > 0 && (
              <span className="flex items-center gap-1">
                <span className="text-cyan-400 text-[10px]">&#x2726;</span>
                {activeMemoryCount} Memories
              </span>
            )}
            {parseltongueConfig.enabled && (
              <span className={`flex items-center gap-1 ${parseltonguePreview ? 'text-green-400' : ''}`}>
                <span className="text-green-500 text-[10px]">&#x2621;</span>
                Parseltongue
                {parseltonguePreview && ` [${parseltonguePreview.triggersFound.length} triggers]`}
              </span>
            )}
            {ultraplinianEnabled && (
              <span className="flex items-center gap-1 text-orange-400">
                <span className="text-[10px]">&#x2694;</span>
                ULTRAPLINIAN [{ultraplinianTier}]
              </span>
            )}
          </div>
          {isStreaming && (
            <span className="flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              {consortiumPhase === 'collecting'
                ? `Collecting ${consortiumModelsCollected}/${consortiumModelsTotal} models...`
                : consortiumPhase === 'synthesizing'
                ? `Synthesizing ground truth...`
                : ultraplinianRacing
                ? `Racing ${ultraplinianModelsResponded}/${ultraplinianModelsTotal} models${ultraplinianLiveModel ? ` // Leader: ${ultraplinianLiveModel.split('/').pop()} (${ultraplinianLiveScore})` : '...'}`
                : autoTuneEnabled && autoTuneLastResult
                  ? `Tuned @ T=${autoTuneLastResult.params.temperature.toFixed(2)}...`
                  : 'Thinking...'
              }
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
