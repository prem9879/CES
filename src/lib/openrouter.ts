/**
 * OpenRouter API Integration
 * Routes requests to multiple AI models via OpenRouter
 */

import { getAccessToken } from '@/lib/session'

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions'

/**
 * Maps API error responses to specific, actionable user-facing messages.
 */
export function formatAPIError(status: number, errorMessage?: string): string {
  const msg = (errorMessage || '').toLowerCase()

  // Authentication / API key issues
  if (status === 401 || msg.includes('invalid api key') || msg.includes('no auth') || msg.includes('unauthorized')) {
    return 'Your OpenRouter API key is invalid or expired. Go to Settings → API Key and enter a valid key from [openrouter.ai/keys](https://openrouter.ai/keys).'
  }
  if (status === 403) {
    if (msg.includes('insufficient') || msg.includes('credit') || msg.includes('balance') || msg.includes('payment')) {
      return 'Your OpenRouter account has insufficient credits. Add credits at [openrouter.ai/credits](https://openrouter.ai/credits), then try again.'
    }
    return 'Access denied by OpenRouter. Your API key may lack permissions for this model, or your account may need credits. Check your key at [openrouter.ai/keys](https://openrouter.ai/keys).'
  }

  // Rate limiting
  if (status === 429 || msg.includes('rate limit') || msg.includes('too many requests')) {
    return 'Rate limited by OpenRouter. Wait a moment and try again, or upgrade your plan at [openrouter.ai](https://openrouter.ai) for higher limits.'
  }

  // Model-specific issues
  if (status === 404 || msg.includes('not found') || msg.includes('no endpoints')) {
    return 'The selected model is currently unavailable on OpenRouter. Try a different model from the model selector.'
  }

  // Content moderation
  if (msg.includes('moderation') || msg.includes('content policy') || msg.includes('flagged')) {
    return 'Your message was flagged by the model\'s content filter. Try rephrasing your prompt.'
  }

  // Upstream / server errors
  if (status === 502 || status === 503 || msg.includes('overloaded') || msg.includes('capacity')) {
    return 'The model provider is temporarily overloaded. Wait a moment and try again, or switch to a different model.'
  }
  if (status >= 500) {
    return 'OpenRouter is experiencing server issues. Try again in a moment.'
  }

  // Timeout
  if (msg.includes('timeout') || msg.includes('timed out')) {
    return 'The request timed out. The model may be under heavy load — try again or switch to a faster model.'
  }

  // Fallback
  return errorMessage || `API error (${status}). Check your API key and network connection.`
}

interface Message {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface SendMessageOptions {
  messages: Message[]
  model: string
  apiKey: string
  noLog?: boolean
  signal?: AbortSignal
  temperature?: number
  maxTokens?: number
  top_p?: number
  top_k?: number
  frequency_penalty?: number
  presence_penalty?: number
  repetition_penalty?: number
}

interface OpenRouterResponse {
  id: string
  model: string
  choices: {
    message: {
      role: string
      content: string
    }
    finish_reason: string
  }[]
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

interface OpenRouterErrorResponse {
  error?: {
    message?: string
  } | string
}

function buildProxyHeaders(cesApiKey: string): HeadersInit {
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${cesApiKey}`,
    'Content-Type': 'application/json',
  }

  const userAccessToken = getAccessToken()
  if (userAccessToken) {
    headers['X-User-Access-Token'] = userAccessToken
  }

  return headers
}

/**
 * Send a message to the AI model via OpenRouter
 */
export async function sendMessage({
  messages,
  model,
  apiKey,
  noLog = false,
  signal,
  temperature = 0.7,
  maxTokens = 512,
  top_p,
  top_k,
  frequency_penalty,
  presence_penalty,
  repetition_penalty
}: SendMessageOptions): Promise<string> {
  if (!apiKey) {
    throw new Error('No API key set. Go to Settings → API Key and enter your OpenRouter key from [openrouter.ai/keys](https://openrouter.ai/keys).')
  }

  // Validate API key before making request
  if (!apiKey || apiKey.trim() === '') {
    throw new Error('No API key set. Go to Settings → API Key and enter your OpenRouter key from [openrouter.ai/keys](https://openrouter.ai/keys).')
  }

  const attempt = async (tokenBudget: number): Promise<string> => {
    const body: Record<string, unknown> = {
      model,
      messages,
      temperature,
      max_tokens: tokenBudget
    }

    if (top_p !== undefined) body.top_p = top_p
    if (top_k !== undefined) body.top_k = top_k
    if (frequency_penalty !== undefined) body.frequency_penalty = frequency_penalty
    if (presence_penalty !== undefined) body.presence_penalty = presence_penalty
    if (repetition_penalty !== undefined) body.repetition_penalty = repetition_penalty

    const providerOptions: Record<string, unknown> = {}
    if (noLog) {
      providerOptions['allow_fallbacks'] = false
    }
    if (Object.keys(providerOptions).length > 0) {
      body.provider = providerOptions
    }

    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://ces.local',
        'X-Title': 'Cognitive-Execution-System'
      },
      body: JSON.stringify(body),
      signal
    })

    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({}))) as OpenRouterErrorResponse
      const message = String(typeof errorData.error === 'string' ? errorData.error : errorData.error?.message || '')
      const isBudgetError = /more credits|afford|max_tokens|token|budget|quota|insufficient/i.test(message)
      if (isBudgetError && tokenBudget > 256) {
        return attempt(Math.max(256, Math.floor(tokenBudget / 2)))
      }
      throw new Error(formatAPIError(response.status, message))
    }

    const data: OpenRouterResponse = await response.json()

    if (!data.choices || data.choices.length === 0) {
      throw new Error('No response from model')
    }

    return data.choices[0].message.content
  }

  return attempt(maxTokens)
}

/**
 * Stream a message response from the AI model
 * (For future implementation)
 */
export async function* streamMessage({
  messages,
  model,
  apiKey,
  noLog = false,
  signal,
  temperature = 0.7,
  maxTokens = 512,
  top_p,
  top_k,
  frequency_penalty,
  presence_penalty,
  repetition_penalty
}: SendMessageOptions): AsyncGenerator<string, void, unknown> {
  if (!apiKey || apiKey.trim() === '') {
    throw new Error('No API key set. Go to Settings → API Key and enter your OpenRouter key from [openrouter.ai/keys](https://openrouter.ai/keys).')
  }

  const streamBody: Record<string, unknown> = {
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
    stream: true
  }

  if (top_p !== undefined) streamBody.top_p = top_p
  if (top_k !== undefined) streamBody.top_k = top_k
  if (frequency_penalty !== undefined) streamBody.frequency_penalty = frequency_penalty
  if (presence_penalty !== undefined) streamBody.presence_penalty = presence_penalty
  if (repetition_penalty !== undefined) streamBody.repetition_penalty = repetition_penalty
  if (noLog) {
    streamBody.provider = { allow_fallbacks: false }
  }

  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://ces.local',
      'X-Title': 'Cognitive-Execution-System'
    },
    body: JSON.stringify(streamBody),
    signal
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(formatAPIError(response.status, errorData.error?.message))
  }

  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error('No response body')
  }

  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || trimmed === 'data: [DONE]') continue
        if (!trimmed.startsWith('data: ')) continue

        try {
          const json = JSON.parse(trimmed.slice(6))
          const content = json.choices?.[0]?.delta?.content
          if (content) {
            yield content
          }
        } catch {
          // Skip invalid JSON
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

/**
 * Get available models from OpenRouter
 */
export async function getModels(apiKey: string): Promise<string[]> {
  const response = await fetch('https://openrouter.ai/api/v1/models', {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://ces.local',
      'X-Title': 'Cognitive-Execution-System'
    }
  })

  if (!response.ok) {
    throw new Error('Failed to fetch models')
  }

  const data = await response.json()
  return data.data.map((model: { id: string }) => model.id)
}

/**
 * Validate an API key
 */
export async function validateApiKey(apiKey: string): Promise<boolean> {
  try {
    await getModels(apiKey)
    return true
  } catch {
    return false
  }
}

export interface ApiKeyHealth {
  ok: boolean
  status: 'valid' | 'invalid' | 'billing' | 'rate_limited' | 'network_error' | 'unknown'
  message: string
}

/**
 * Validate key health with actionable status for settings UX.
 */
export async function checkApiKeyHealth(apiKey: string): Promise<ApiKeyHealth> {
  const trimmed = apiKey.trim()
  if (!trimmed) {
    return {
      ok: false,
      status: 'invalid',
      message: 'No API key provided. Add your OpenRouter key first.',
    }
  }

  try {
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      headers: {
        'Authorization': `Bearer ${trimmed}`,
        'HTTP-Referer': 'https://ces.local',
        'X-Title': 'Cognitive-Execution-System',
      }
    })

    if (response.ok) {
      return {
        ok: true,
        status: 'valid',
        message: 'Key is valid and OpenRouter is reachable.',
      }
    }

    const errorData = (await response.json().catch(() => ({}))) as OpenRouterErrorResponse
    const rawMessage = String(typeof errorData.error === 'string' ? errorData.error : errorData.error?.message || '').toLowerCase()

    if (response.status === 401 || rawMessage.includes('invalid') || rawMessage.includes('unauthorized')) {
      return {
        ok: false,
        status: 'invalid',
        message: 'Invalid or expired API key. Generate a fresh key at openrouter.ai/keys.',
      }
    }

    if (
      response.status === 403 ||
      rawMessage.includes('credit') ||
      rawMessage.includes('balance') ||
      rawMessage.includes('insufficient') ||
      rawMessage.includes('billing')
    ) {
      return {
        ok: false,
        status: 'billing',
        message: 'Key accepted but credits/permissions are insufficient. Check billing at openrouter.ai/credits.',
      }
    }

    if (response.status === 429 || rawMessage.includes('rate limit')) {
      return {
        ok: false,
        status: 'rate_limited',
        message: 'Rate limited by OpenRouter. Wait briefly and retry.',
      }
    }

    return {
      ok: false,
      status: 'unknown',
      message: `Health check failed (${response.status}).`,
    }
  } catch {
    return {
      ok: false,
      status: 'network_error',
      message: 'Network error while checking key health. Verify connection and try again.',
    }
  }
}

// ── Proxy Mode: Route standard chat through self-hosted API ───────────

interface ProxyMessageOptions {
  messages: Message[]
  model: string
  apiBaseUrl: string
  cesApiKey: string
  signal?: AbortSignal
  temperature?: number
  maxTokens?: number
  top_p?: number
  top_k?: number
  frequency_penalty?: number
  presence_penalty?: number
  repetition_penalty?: number
  ces?: boolean
  stm_modules?: string[]
}

/**
 * Send a message via the self-hosted CES API server.
 * Used in proxy mode when no personal OpenRouter key is available —
 * the server uses its own server-side key.
 */
export async function sendMessageViaProxy({
  messages,
  model,
  apiBaseUrl,
  cesApiKey,
  signal,
  temperature,
  maxTokens = 512,
  top_p,
  top_k,
  frequency_penalty,
  presence_penalty,
  repetition_penalty,
  ces = true,
  stm_modules = ['hedge_reducer', 'direct_mode'],
}: ProxyMessageOptions): Promise<string> {
  // Validate API key
  if (!cesApiKey || cesApiKey.trim() === '') {
    throw new Error('No API key available for proxy mode. Check your configuration.')
  }

  const attempt = async (tokenBudget: number): Promise<string> => {
    const body: Record<string, unknown> = {
      messages,
      model,
      max_tokens: tokenBudget,
      ces,
      stm_modules,
    }

    if (temperature !== undefined) body.temperature = temperature
    if (top_p !== undefined) body.top_p = top_p
    if (top_k !== undefined) body.top_k = top_k
    if (frequency_penalty !== undefined) body.frequency_penalty = frequency_penalty
    if (presence_penalty !== undefined) body.presence_penalty = presence_penalty
    if (repetition_penalty !== undefined) body.repetition_penalty = repetition_penalty

    const response = await fetch(`${apiBaseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: buildProxyHeaders(cesApiKey),
      body: JSON.stringify(body),
      signal,
    })

    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({}))) as OpenRouterErrorResponse
      const errorMessage = String(typeof errorData.error === 'string' ? errorData.error : errorData.error?.message || `API error: ${response.status}`)
      const isBudgetError = /more credits|afford|max_tokens|token|budget|quota|insufficient/i.test(errorMessage)
      if (isBudgetError && tokenBudget > 256) {
        return attempt(Math.max(256, Math.floor(tokenBudget / 2)))
      }
      throw new Error(errorMessage)
    }

    const data = await response.json()

    if (!data.choices || data.choices.length === 0) {
      throw new Error('No response from model')
    }

    return data.choices[0].message.content
  }

  return attempt(maxTokens)
}

// ── CONSORTIUM Streaming (Hive-Mind Synthesis) ────────────────────────

export interface ConsortiumModel {
  model: string
  score: number
  duration_ms: number
  success: boolean
  error?: string
  content_length: number
  models_collected: number
  models_total: number
}

export interface ConsortiumComplete {
  synthesis: string
  orchestrator: { model: string; duration_ms: number }
  collection: {
    tier: string
    models_queried: number
    models_succeeded: number
    collection_duration_ms: number
    total_duration_ms: number
    responses: Array<{
      model: string; score: number; duration_ms: number
      success: boolean; error?: string; content_length: number
    }>
  }
  params_used: Record<string, number | undefined>
  pipeline: {
    ces: boolean
    autotune: { detected_context: string; confidence: number; reasoning: string; strategy: string } | null
    parseltongue: { triggers_found: string[]; technique_used: string; transformations_count: number } | null
    stm: { modules_applied: string[]; original_length: number; transformed_length: number } | null
  }
}

export interface ConsortiumCallbacks {
  onStart?: (data: { tier: string; models_queried: number; orchestrator: string }) => void
  onModelResult?: (data: ConsortiumModel) => void
  /** Liquid response: fires when a new best individual response arrives during collection */
  onBestResponse?: (data: { model: string; content: string; score: number; duration_ms: number }) => void
  onSynthesisStart?: (data: { orchestrator: string; responses_collected: number; collection_duration_ms: number }) => void
  onComplete?: (data: ConsortiumComplete) => void
  onError?: (error: string) => void
}

export interface ConsortiumOptions {
  messages: Message[]
  openrouterApiKey: string
  apiBaseUrl: string
  cesApiKey: string
  tier?: 'fast' | 'standard' | 'smart' | 'power' | 'ultra'
  orchestrator_model?: string
  ces?: boolean
  autotune?: boolean
  strategy?: string
  parseltongue?: boolean
  parseltongue_technique?: string
  parseltongue_intensity?: string
  stm_modules?: string[]
  /** Liquid response: show best individual response while synthesizing, morph to final */
  liquid?: boolean
  /** Minimum score improvement to trigger a leader upgrade (1-50). Default 8. */
  liquid_min_delta?: number
  signal?: AbortSignal
}

/**
 * Stream a CONSORTIUM synthesis via SSE.
 *
 * Phase 1: Model collection events fire as each model responds.
 * Phase 2: Orchestrator synthesis starts after collection.
 * Phase 3: Complete event with full metadata.
 */
export async function streamConsortium(
  options: ConsortiumOptions,
  callbacks: ConsortiumCallbacks,
): Promise<void> {
  const {
    messages, openrouterApiKey, apiBaseUrl, cesApiKey,
    tier = 'fast', orchestrator_model, ces = true,
    autotune = true, strategy = 'adaptive',
    parseltongue = true, parseltongue_technique = 'leetspeak',
    parseltongue_intensity = 'medium', stm_modules = ['hedge_reducer', 'direct_mode'],
    liquid = true, liquid_min_delta = 8,
    signal,
  } = options

  const response = await fetch(`${apiBaseUrl}/v1/consortium/completions`, {
    method: 'POST',
    headers: buildProxyHeaders(cesApiKey),
    body: JSON.stringify({
      messages, openrouter_api_key: openrouterApiKey, tier, orchestrator_model,
      ces, autotune, strategy, parseltongue, parseltongue_technique,
      parseltongue_intensity, stm_modules, stream: true, liquid, liquid_min_delta,
    }),
    signal,
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(formatAPIError(response.status, err.error))
  }

  const reader = response.body?.getReader()
  if (!reader) throw new Error('No response body from CONSORTIUM stream')

  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      let currentEvent = ''
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) { currentEvent = ''; continue }
        if (trimmed.startsWith('event: ')) { currentEvent = trimmed.slice(7); continue }
        if (trimmed.startsWith('data: ')) {
          try {
            const data = JSON.parse(trimmed.slice(6))
            switch (currentEvent) {
              case 'consortium:start':
                callbacks.onStart?.(data)
                break
              case 'consortium:model':
                callbacks.onModelResult?.(data)
                break
              case 'consortium:leader':
                callbacks.onBestResponse?.(data)
                break
              case 'consortium:synthesis:start':
                callbacks.onSynthesisStart?.(data)
                break
              case 'consortium:complete':
                callbacks.onComplete?.(data)
                break
              case 'consortium:error':
                callbacks.onError?.(data.error)
                break
            }
          } catch {}
          currentEvent = ''
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

// ── ULTRAPLINIAN Streaming (Liquid Response) ──────────────────────────

export interface UltraplinianRaceModel {
  model: string
  score: number
  duration_ms: number
  success: boolean
  error?: string
  content_length: number
  models_responded: number
  models_total: number
}

export interface UltraplinianLeader {
  model: string
  score: number
  duration_ms: number
  content: string
}

export interface UltraplinianComplete {
  response: string
  winner: { model: string; score: number; duration_ms: number } | null
  race: {
    tier: string
    models_queried: number
    models_succeeded: number
    total_duration_ms: number
    rankings: Array<{
      model: string; score: number; duration_ms: number
      success: boolean; error?: string; content_length: number
      content?: string
    }>
  }
  params_used: Record<string, number | undefined>
  pipeline: {
    ces: boolean
    autotune: { detected_context: string; confidence: number; reasoning: string; strategy: string } | null
    parseltongue: { triggers_found: string[]; technique_used: string; transformations_count: number } | null
    stm: { modules_applied: string[]; original_length: number; transformed_length: number } | null
  }
}

export interface UltraplinianCallbacks {
  onRaceStart?: (data: { tier: string; models_queried: number }) => void
  onModelResult?: (data: UltraplinianRaceModel) => void
  onLeaderChange?: (data: UltraplinianLeader) => void
  onComplete?: (data: UltraplinianComplete) => void
  onError?: (error: string) => void
}

export interface UltraplinianOptions {
  messages: Message[]
  openrouterApiKey: string
  apiBaseUrl: string
  cesApiKey: string
  tier?: 'fast' | 'standard' | 'smart' | 'power' | 'ultra'
  ces?: boolean
  autotune?: boolean
  strategy?: string
  parseltongue?: boolean
  parseltongue_technique?: string
  parseltongue_intensity?: string
  stm_modules?: string[]
  /** Enable liquid response (SSE streaming with live leader upgrades). Default true. */
  liquid?: boolean
  /** Minimum score improvement to trigger a leader upgrade (1-50). Default 8. */
  liquid_min_delta?: number
  signal?: AbortSignal
}

/**
 * Stream an ULTRAPLINIAN race via SSE.
 *
 * Connects to the backend's streaming endpoint and fires callbacks
 * as models finish. The first good response arrives in ~3-5s,
 * with live upgrades as better responses come in.
 */
export async function streamUltraplinian(
  options: UltraplinianOptions,
  callbacks: UltraplinianCallbacks,
): Promise<void> {
  const {
    messages, openrouterApiKey, apiBaseUrl, cesApiKey,
    tier = 'fast', ces = true, autotune = true, strategy = 'adaptive',
    parseltongue = true, parseltongue_technique = 'leetspeak',
    parseltongue_intensity = 'medium', stm_modules = ['hedge_reducer', 'direct_mode'],
    liquid = true, liquid_min_delta = 8,
    signal,
  } = options

  const response = await fetch(`${apiBaseUrl}/v1/ultraplinian/completions`, {
    method: 'POST',
    headers: buildProxyHeaders(cesApiKey),
    body: JSON.stringify({
      messages, openrouter_api_key: openrouterApiKey, tier, ces,
      autotune, strategy, parseltongue, parseltongue_technique,
      parseltongue_intensity, stm_modules, stream: liquid, liquid_min_delta,
    }),
    signal,
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(formatAPIError(response.status, err.error))
  }

  const reader = response.body?.getReader()
  if (!reader) throw new Error('No response body from ULTRAPLINIAN stream')

  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      let currentEvent = ''
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) {
          currentEvent = ''
          continue
        }
        if (trimmed.startsWith('event: ')) {
          currentEvent = trimmed.slice(7)
          continue
        }
        if (trimmed.startsWith('data: ')) {
          try {
            const data = JSON.parse(trimmed.slice(6))
            switch (currentEvent) {
              case 'race:start':
                callbacks.onRaceStart?.(data)
                break
              case 'race:model':
                callbacks.onModelResult?.(data)
                break
              case 'race:leader':
                callbacks.onLeaderChange?.(data)
                break
              case 'race:complete':
                callbacks.onComplete?.(data)
                break
              case 'race:error':
                callbacks.onError?.(data.error)
                break
            }
          } catch {}
          currentEvent = ''
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}
