/**
 * Chat Completions API Route (Single-Model Pipeline)
 *
 * POST /v1/chat/completions
 *
 * OpenAI-compatible endpoint. Drop-in replacement for the OpenAI SDK:
 *   openai.OpenAI(base_url="https://your-api.com/v1", api_key="sk-...")
 *
 * Accepts standard OpenAI format and returns standard format.
 * NOVAOS pipeline (CES, AutoTune, Parseltongue, STM) runs transparently
 * behind the standard interface. Pipeline metadata is in `x_novaos`.
 *
 * Supports stream: true (SSE, OpenAI chunk format).
 *
 * For multi-model racing, use POST /v1/ultraplinian/completions instead.
 */

import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import OpenAI from 'openai'
import { computeAutoTuneParams, type AutoTuneStrategy } from '../../src/lib/autotune'
import { applyParseltongue, type ParseltongueConfig } from '../../src/lib/parseltongue'
import { allModules, applySTMs, type STMModule } from '../../src/stm/modules'
import { sendMessage } from '../../src/lib/openrouter'
import { getSharedProfiles } from './autotune'
import {
  CES_SYSTEM_PROMPT,
  DEPTH_DIRECTIVE,
  applyCESBoost,
  getModelsForTier,
  raceModels,
  scoreResponse,
  type SpeedTier,
  type ModelResult,
} from '../lib/ultraplinian'
import {
  collectAllResponses,
  synthesize,
  ORCHESTRATOR_MODELS,
  type OrchestratorModel,
  type ConsortiumResponse,
} from '../lib/consortium'
import { addEntry } from '../lib/dataset'
import { recordEvent, categorizeError } from '../lib/metadata'
import { isRaceTierAllowedForPlan, resolveOptionalAuthenticatedEntitlements } from '../lib/user-entitlements'

export const chatRoutes = Router()

const OPENROUTER_CHAT_URL = 'https://openrouter.ai/api/v1/chat/completions'

function resolveOpenRouterKey(req: { body?: { openrouter_api_key?: string }; headers?: { authorization?: string | string[] } }): string {
  const fromBody = typeof req.body?.openrouter_api_key === 'string' ? req.body.openrouter_api_key : ''
  if (fromBody) return fromBody

  const authHeader = Array.isArray(req.headers?.authorization)
    ? req.headers?.authorization[0]
    : req.headers?.authorization

  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7).trim()
  }

  return process.env.OPENROUTER_API_KEY || ''
}

chatRoutes.post('/analyze-image', async (req, res) => {
  try {
    const imageBase64 = typeof req.body?.image_base64 === 'string' ? req.body.image_base64 : ''
    const mimeType = typeof req.body?.mime_type === 'string' ? req.body.mime_type : 'image/jpeg'
    const prompt = typeof req.body?.prompt === 'string'
      ? req.body.prompt
      : 'Analyze this image with concrete details and extract all visible text.'

    if (!imageBase64) {
      res.status(400).json({ error: 'image_base64 is required.' })
      return
    }

    const openrouterKey = resolveOpenRouterKey(req)
    if (!openrouterKey) {
      res.status(400).json({ error: 'No OpenRouter key available for image analysis.' })
      return
    }

    const response = await fetch(OPENROUTER_CHAT_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openrouterKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://ces.local',
        'X-Title': 'Cognitive-Execution-System',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        temperature: 0.2,
        max_tokens: 600,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
            ],
          },
        ],
      }),
    })

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({}))
      res.status(response.status).json({ error: String((errorPayload as { error?: { message?: string } }).error?.message || 'Image analysis failed.') })
      return
    }

    const data = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>
    }

    const summary = data.choices?.[0]?.message?.content?.trim() || ''
    res.json({ summary })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Image analysis failed.'
    res.status(500).json({ error: message })
  }
})

chatRoutes.post('/transcribe-audio', async (req, res) => {
  try {
    const audioBase64 = typeof req.body?.audio_base64 === 'string' ? req.body.audio_base64 : ''
    const mimeType = typeof req.body?.mime_type === 'string' ? req.body.mime_type : 'audio/mpeg'
    const fileName = typeof req.body?.file_name === 'string' ? req.body.file_name : 'audio-input.wav'

    if (!audioBase64) {
      res.status(400).json({ error: 'audio_base64 is required.' })
      return
    }

    const openaiKey = process.env.OPENAI_API_KEY
    if (!openaiKey) {
      res.status(200).json({
        transcript: 'Audio attached. Set OPENAI_API_KEY on the server to enable high-quality transcription.',
        quality: 'fallback',
      })
      return
    }

    const client = new OpenAI({ apiKey: openaiKey })
    const bytes = Buffer.from(audioBase64, 'base64')
    const audioFile = new File([bytes], fileName, { type: mimeType })

    const result = await client.audio.transcriptions.create({
      file: audioFile,
      model: 'gpt-4o-mini-transcribe',
    })

    res.json({
      transcript: result.text?.trim() || '',
      quality: 'high',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Audio transcription failed.'
    res.status(500).json({ error: message })
  }
})

// ── Shared helpers ────────────────────────────────────────────────────

function estimateTokens(text: string): number {
  // Rough estimate: ~4 chars per token for English
  return Math.ceil(text.length / 4)
}

/**
 * Build the NOVAOS pipeline: resolve params, system prompt, parseltongue, etc.
 * Returns everything needed to send to the LLM and build the response.
 */
function runPipeline(opts: {
  messages: Array<{ role: string; content: string }>
  model: string
  ces: boolean
  custom_system_prompt?: string
  autotune: boolean
  strategy: string
  parseltongue: boolean
  parseltongue_technique: string
  parseltongue_intensity: string
  stm_modules: string[]
  temperature?: number
  top_p?: number
  top_k?: number
  frequency_penalty?: number
  presence_penalty?: number
  repetition_penalty?: number
}) {
  const {
    messages, ces, custom_system_prompt,
    autotune, strategy, parseltongue,
    parseltongue_technique, parseltongue_intensity, stm_modules,
    temperature, top_p, top_k,
    frequency_penalty, presence_penalty, repetition_penalty,
  } = opts

  // Normalize messages
  const normalizedMessages = messages.map((m: any) => ({
    role: m.role as 'system' | 'user' | 'assistant',
    content: String(m.content || ''),
  }))

  // Build system prompt
  const systemPrompt = ces
    ? (custom_system_prompt || CES_SYSTEM_PROMPT) + DEPTH_DIRECTIVE
    : custom_system_prompt || ''

  const allMessages = [
    ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
    ...normalizedMessages.filter(m => m.role !== 'system'),
  ]

  // AutoTune
  const lastUserMsg = [...normalizedMessages].reverse().find(m => m.role === 'user')
  const userContent = lastUserMsg?.content || ''
  const conversationHistory = normalizedMessages
    .filter(m => m.role !== 'system')
    .map(m => ({ role: m.role, content: m.content }))

  let autotuneResult: any = null
  let finalParams: Record<string, number | undefined> = {
    temperature: temperature ?? 0.7,
    top_p, top_k, frequency_penalty, presence_penalty, repetition_penalty,
  }

  if (autotune && temperature === undefined) {
    autotuneResult = computeAutoTuneParams({
      strategy: strategy as AutoTuneStrategy,
      message: userContent,
      conversationHistory,
      overrides: {
        ...(top_p !== undefined && { top_p }),
        ...(top_k !== undefined && { top_k }),
        ...(frequency_penalty !== undefined && { frequency_penalty }),
        ...(presence_penalty !== undefined && { presence_penalty }),
        ...(repetition_penalty !== undefined && { repetition_penalty }),
      },
      learnedProfiles: getSharedProfiles(),
    })
    finalParams = {
      temperature: autotuneResult.params.temperature,
      top_p: autotuneResult.params.top_p,
      top_k: autotuneResult.params.top_k,
      frequency_penalty: autotuneResult.params.frequency_penalty,
      presence_penalty: autotuneResult.params.presence_penalty,
      repetition_penalty: autotuneResult.params.repetition_penalty,
    }
  }

  if (ces) {
    finalParams = applyCESBoost(finalParams)
  }

  // Parseltongue
  let parseltongueResult: any = null
  let processedMessages = allMessages

  if (parseltongue) {
    const ptConfig: ParseltongueConfig = {
      enabled: true,
      technique: parseltongue_technique as any,
      intensity: parseltongue_intensity as any,
      customTriggers: [],
    }

    processedMessages = allMessages.map(m => {
      if (m.role === 'user') {
        const result = applyParseltongue(m.content, ptConfig)
        if (!parseltongueResult && result.triggersFound.length > 0) {
          parseltongueResult = {
            triggers_found: result.triggersFound,
            technique_used: result.techniqueUsed,
            transformations_count: result.transformations.length,
          }
        }
        return { ...m, content: result.transformedText }
      }
      return m
    })
  }

  return {
    processedMessages,
    normalizedMessages,
    finalParams,
    autotuneResult,
    parseltongueResult,
    stm_modules,
    userContent,
    strategy,
    ces,
  }
}

function applySTMPost(response: string, stm_modules: string[]) {
  if (!stm_modules || !Array.isArray(stm_modules) || stm_modules.length === 0) {
    return { finalResponse: response, stmResult: null }
  }
  const enabledModules: STMModule[] = allModules.map(m => ({
    ...m,
    enabled: stm_modules.includes(m.id),
  }))
  const finalResponse = applySTMs(response, enabledModules)
  return {
    finalResponse,
    stmResult: {
      modules_applied: stm_modules,
      original_length: response.length,
      transformed_length: finalResponse.length,
    },
  }
}

function getLastUserMessage(messages: Array<{ role: string; content: string }>): string {
  for (let index = messages.length - 1; index >= 0; index--) {
    if (messages[index]?.role === 'user') {
      return String(messages[index].content || '')
    }
  }
  return ''
}

function looksLikeWeatherQuery(text: string): boolean {
  return /\b(weather|forecast|temperature|rain|rainy|snow|snowy|wind|humidity|sunny|cloudy|storm|conditions?)\b/i.test(text)
}

function extractLocationHint(text: string): string | null {
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
    const response = await fetch(url, { signal: controller.signal, headers: { 'accept': 'application/json' } })
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

async function lookupWeatherSummary(query: string): Promise<string | null> {
  const explicitLocation = extractLocationHint(query)
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
      is_day?: number
      time?: string
    }
    daily?: {
      time?: string[]
      temperature_2m_max?: number[]
      temperature_2m_min?: number[]
      weather_code?: number[]
    }
  }>(
    `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,relative_humidity_2m,is_day&daily=temperature_2m_max,temperature_2m_min,weather_code&forecast_days=2&timezone=auto`,
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

  lines.push('If you want a different city, tell me the location and I’ll refresh it live.')
  return lines.join(' ')
}

chatRoutes.post('/live-weather', async (req, res) => {
  try {
    const prompt = typeof req.body?.query === 'string' ? req.body.query.trim() : ''
    if (!prompt) {
      res.status(400).json({ error: 'Missing weather query.' })
      return
    }

    const liveWeather = await lookupWeatherSummary(prompt)
    if (!liveWeather) {
      res.status(404).json({ error: 'Unable to determine live weather for that location.' })
      return
    }

    res.json({
      location: prompt,
      content: liveWeather,
      model: 'live-weather',
      source: 'open-meteo',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Weather lookup failed.'
    res.status(500).json({ error: message })
  }
})

// ── POST /v1/chat/completions ─────────────────────────────────────────

chatRoutes.post('/completions', async (req, res) => {
  const startTime = Date.now()
  const completionId = `chatcmpl-${uuidv4().replace(/-/g, '').slice(0, 24)}`

  try {
    const {
      messages,
      model = 'nousresearch/hermes-4-70b',
      openrouter_api_key: caller_key,
      stream = false,
      max_tokens = 1024,
      // NOVAOS pipeline options (optional — transparent to OpenAI SDK users)
      ces = true,
      custom_system_prompt,
      autotune = true,
      strategy = 'adaptive',
      parseltongue = true,
      parseltongue_technique = 'leetspeak',
      parseltongue_intensity = 'medium',
      stm_modules = ['hedge_reducer', 'direct_mode'],
      // Direct param overrides
      temperature,
      top_p,
      top_k,
      frequency_penalty,
      presence_penalty,
      repetition_penalty,
      no_log = false,
      // Dataset opt-in
      contribute_to_dataset = false,
    } = req.body

    // Validate
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({
        error: {
          message: 'messages (array) is required and must not be empty',
          type: 'invalid_request_error',
          code: 'invalid_messages',
        }
      })
      return
    }

    if (messages.length > 100) {
      res.status(400).json({
        error: {
          message: 'Too many messages (max 100)',
          type: 'invalid_request_error',
          code: 'too_many_messages',
        }
      })
      return
    }

    const livePrompt = getLastUserMessage(messages)
    if (looksLikeWeatherQuery(livePrompt)) {
      const liveWeather = await lookupWeatherSummary(livePrompt)
      if (liveWeather) {
        const promptTokens = estimateTokens(messages.map(m => String(m.content || '')).join(' '))
        const completionTokens = estimateTokens(liveWeather)
        res.json({
          id: completionId,
          object: 'chat.completion',
          created: Math.floor(Date.now() / 1000),
          model: 'live-weather',
          choices: [{
            index: 0,
            message: { role: 'assistant', content: liveWeather },
            finish_reason: 'stop',
          }],
          usage: {
            prompt_tokens: promptTokens,
            completion_tokens: completionTokens,
            total_tokens: promptTokens + completionTokens,
          },
          x_novaos: {
            mode: 'live-weather',
            source: 'open-meteo',
          },
        })
        return
      }
    }

    // Resolve OpenRouter key
    let openrouter_api_key = caller_key || process.env.OPENROUTER_API_KEY || ''
    
    // Check for Authorization header as fallback (for local dev mode or Bearer tokens)
    if (!openrouter_api_key) {
      const authHeader = req.headers.authorization
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const bearerToken = authHeader.slice(7).trim()
        // Allow local-dev-mode or any Bearer token in dev environment
        if (bearerToken === 'local-dev-mode' || process.env.NODE_ENV !== 'production') {
          openrouter_api_key = bearerToken
        }
      }
    }
    
    if (!openrouter_api_key) {
      res.status(400).json({
        error: {
          message: 'No OpenRouter API key available. Either pass openrouter_api_key in the request body, set Authorization header with Bearer token, or set OPENROUTER_API_KEY on the server.',
          type: 'invalid_request_error',
          code: 'missing_api_key',
        }
      })
      return
    }

    // ── ULTRAPLINIAN virtual model routing ─────────────────────────────
    // model="ultraplinian/fast" | "ultraplinian/standard" | "ultraplinian/smart" | "ultraplinian/power" | "ultraplinian/ultra"
    // → runs multi-model race, returns winner in OpenAI format
    const ultraplinianMatch = model.match(/^ultraplinian\/(fast|standard|smart|power|ultra)$/)
    if (ultraplinianMatch) {
      const raceTier = ultraplinianMatch[1] as SpeedTier

      try {
        const userEntitlements = resolveOptionalAuthenticatedEntitlements(req)
        if (userEntitlements && !isRaceTierAllowedForPlan(raceTier, userEntitlements.plan)) {
          res.status(403).json({
            error: {
              message: `Your ${userEntitlements.plan.toUpperCase()} plan allows ULTRAPLINIAN up to ${userEntitlements.maxRaceTier.toUpperCase()}.`,
              type: 'insufficient_tier',
              code: 'upgrade_required',
            },
          })
          return
        }
      } catch (error) {
        res.status(401).json({
          error: {
            message: error instanceof Error ? error.message : 'Invalid user access token.',
            type: 'invalid_request_error',
            code: 'invalid_user_token',
          },
        })
        return
      }

      // Check tier-based access
      const tierConfig = req.tierConfig
      if (tierConfig && !tierConfig.ultraplinianTiers.includes(raceTier)) {
        const currentTier = req.tier || 'free'
        res.status(403).json({
          error: {
            message: `The "${raceTier}" ULTRAPLINIAN tier requires a higher plan. Your "${currentTier}" plan allows: ${tierConfig.ultraplinianTiers.join(', ')}.`,
            type: 'insufficient_tier',
            code: 'upgrade_required',
          },
        })
        return
      }

      // Run pipeline for ULTRAPLINIAN
      const pipeline = runPipeline({
        messages, model, ces, custom_system_prompt,
        autotune, strategy, parseltongue,
        parseltongue_technique, parseltongue_intensity, stm_modules,
        temperature, top_p, top_k,
        frequency_penalty, presence_penalty, repetition_penalty,
      })

      const raceModelsArray = getModelsForTier(raceTier)

      // Cap by tier if applicable
      const maxModels = tierConfig?.maxRaceModels ?? raceModelsArray.length
      const models = raceModelsArray.slice(0, maxModels)

      const raceParams = {
        temperature: pipeline.finalParams.temperature ?? 0.7,
        max_tokens,
        top_p: pipeline.finalParams.top_p,
        top_k: pipeline.finalParams.top_k,
        frequency_penalty: pipeline.finalParams.frequency_penalty,
        presence_penalty: pipeline.finalParams.presence_penalty,
        repetition_penalty: pipeline.finalParams.repetition_penalty,
      }

      const results = await raceModels(
        models,
        pipeline.processedMessages,
        openrouter_api_key,
        raceParams,
        { minResults: Math.min(5, models.length), gracePeriod: 5000, hardTimeout: 45000 },
      )

      const scoredResults: ModelResult[] = results.map(r => ({
        ...r,
        score: r.success ? scoreResponse(r.content, pipeline.userContent) : 0,
      }))
      scoredResults.sort((a, b) => b.score - a.score)

      const winner = scoredResults.find(r => r.success)
      if (!winner || !winner.content) {
        res.status(502).json({
          error: {
            message: 'All models failed in ULTRAPLINIAN race',
            type: 'upstream_error',
            code: 'race_failed',
          },
        })
        return
      }

      // STM
      const { finalResponse, stmResult } = applySTMPost(winner.content, stm_modules)
      const totalDuration = Date.now() - startTime
      const successCount = scoredResults.filter(r => r.success).length

      // Dataset
      let datasetId: string | null = null
      if (contribute_to_dataset) {
        datasetId = addEntry({
          endpoint: '/v1/chat/completions',
          model: winner.model, mode: 'ultraplinian',
          messages: pipeline.normalizedMessages.filter(m => m.role !== 'system'),
          response: finalResponse,
          autotune: pipeline.autotuneResult ? { strategy, detected_context: pipeline.autotuneResult.detectedContext, confidence: pipeline.autotuneResult.confidence, params: pipeline.autotuneResult.params, reasoning: pipeline.autotuneResult.reasoning } : undefined,
          parseltongue: pipeline.parseltongueResult || undefined,
          stm: stmResult ? { modules_applied: stmResult.modules_applied } : undefined,
          ultraplinian: { tier: raceTier, models_queried: models, winner_model: winner.model, all_scores: scoredResults.map(r => ({ model: r.model, score: r.score, duration_ms: r.duration_ms, success: r.success })), total_duration_ms: totalDuration },
        })
      }

      // Metadata
      recordEvent({
        endpoint: '/v1/chat/completions',
        mode: 'ultraplinian',
        tier: raceTier,
        stream: false,
        pipeline: {
          ces: pipeline.ces,
          autotune: !!pipeline.autotuneResult,
          parseltongue: !!pipeline.parseltongueResult,
          stm_modules: stm_modules || [],
          strategy: pipeline.strategy,
        },
        autotune: pipeline.autotuneResult
          ? { detected_context: pipeline.autotuneResult.detectedContext, confidence: pipeline.autotuneResult.confidence }
          : undefined,
        models_queried: models.length,
        models_succeeded: successCount,
        model_results: scoredResults.map(r => ({
          model: r.model, score: r.score, duration_ms: r.duration_ms,
          success: r.success, content_length: r.content?.length || 0,
          error_type: categorizeError(r.error),
        })),
        winner: { model: winner.model, score: winner.score, duration_ms: winner.duration_ms, content_length: finalResponse.length },
        total_duration_ms: totalDuration,
        response_length: finalResponse.length,
      })

      // Token estimates
      const promptText = pipeline.processedMessages.map(m => m.content).join(' ')
      const promptTokens = estimateTokens(promptText)
      const completionTokens = estimateTokens(finalResponse)

      // OpenAI-compatible response with race metadata
      res.json({
        id: completionId,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: winner.model,
        choices: [{
          index: 0,
          message: { role: 'assistant', content: finalResponse },
          finish_reason: 'stop',
        }],
        usage: {
          prompt_tokens: promptTokens,
          completion_tokens: completionTokens,
          total_tokens: promptTokens + completionTokens,
        },
        x_novaos: {
          mode: 'ultraplinian',
          winner: { model: winner.model, score: winner.score, duration_ms: winner.duration_ms },
          race: {
            tier: raceTier,
            models_queried: models.length,
            models_succeeded: successCount,
            total_duration_ms: totalDuration,
            rankings: scoredResults.filter(r => r.success).slice(0, 5).map(r => ({
              model: r.model, score: r.score, duration_ms: r.duration_ms,
            })),
          },
          params_used: pipeline.finalParams,
          pipeline: {
            ces: pipeline.ces,
            autotune: pipeline.autotuneResult
              ? { detected_context: pipeline.autotuneResult.detectedContext, confidence: pipeline.autotuneResult.confidence, strategy: pipeline.strategy }
              : null,
            parseltongue: pipeline.parseltongueResult,
            stm: stmResult,
          },
          dataset: contribute_to_dataset ? { contributed: true, entry_id: datasetId } : { contributed: false },
        },
      })
      return
    }

    // ── CONSORTIUM virtual model routing ─────────────────────────────
    // model="consortium/fast" | "consortium/standard" | "consortium/smart" | "consortium/power" | "consortium/ultra"
    // → collects ALL model responses, orchestrator synthesizes ground truth
    const consortiumMatch = model.match(/^consortium\/(fast|standard|smart|power|ultra)$/)
    if (consortiumMatch) {
      const raceTier = consortiumMatch[1] as SpeedTier

      try {
        const userEntitlements = resolveOptionalAuthenticatedEntitlements(req)
        if (userEntitlements && !userEntitlements.consortiumEnabled) {
          res.status(403).json({
            error: {
              message: 'CONSORTIUM requires Pro or Enterprise.',
              type: 'insufficient_tier',
              code: 'upgrade_required',
            },
          })
          return
        }
        if (userEntitlements && !isRaceTierAllowedForPlan(raceTier, userEntitlements.plan)) {
          res.status(403).json({
            error: {
              message: `Your ${userEntitlements.plan.toUpperCase()} plan allows CONSORTIUM up to ${userEntitlements.maxRaceTier.toUpperCase()}.`,
              type: 'insufficient_tier',
              code: 'upgrade_required',
            },
          })
          return
        }
      } catch (error) {
        res.status(401).json({
          error: {
            message: error instanceof Error ? error.message : 'Invalid user access token.',
            type: 'invalid_request_error',
            code: 'invalid_user_token',
          },
        })
        return
      }

      // Tier access check
      const tierConfig = req.tierConfig
      if (tierConfig && !tierConfig.ultraplinianTiers.includes(raceTier)) {
        const currentTier = req.tier || 'free'
        res.status(403).json({
          error: {
            message: `The "${raceTier}" CONSORTIUM tier requires a higher plan. Your "${currentTier}" plan allows: ${tierConfig.ultraplinianTiers.join(', ')}.`,
            type: 'insufficient_tier',
            code: 'upgrade_required',
          },
        })
        return
      }

      const pipeline = runPipeline({
        messages, model, ces, custom_system_prompt,
        autotune, strategy, parseltongue,
        parseltongue_technique, parseltongue_intensity, stm_modules,
        temperature, top_p, top_k,
        frequency_penalty, presence_penalty, repetition_penalty,
      })

      const raceModelsArray = getModelsForTier(raceTier)
      const maxModels = tierConfig?.maxRaceModels ?? raceModelsArray.length
      const models = raceModelsArray.slice(0, maxModels)

      const queryParams = {
        temperature: pipeline.finalParams.temperature ?? 0.7,
        max_tokens,
        top_p: pipeline.finalParams.top_p,
        top_k: pipeline.finalParams.top_k,
        frequency_penalty: pipeline.finalParams.frequency_penalty,
        presence_penalty: pipeline.finalParams.presence_penalty,
        repetition_penalty: pipeline.finalParams.repetition_penalty,
      }

      // Phase 1: Collect all responses
      const results = await collectAllResponses(
        models,
        pipeline.processedMessages,
        openrouter_api_key,
        queryParams,
        { minResponses: Math.min(3, models.length), hardTimeout: 60000 },
      )

      const scoredResponses: ConsortiumResponse[] = results.map(r => ({
        model: r.model,
        content: r.content,
        score: r.success ? scoreResponse(r.content, pipeline.userContent) : 0,
        duration_ms: r.duration_ms,
        success: r.success,
        error: r.error,
      }))
      scoredResponses.sort((a, b) => b.score - a.score)

      const totalSucceeded = scoredResponses.filter(r => r.success).length
      if (totalSucceeded === 0) {
        res.status(502).json({
          error: { message: 'All models failed in CONSORTIUM collection', type: 'upstream_error', code: 'collection_failed' },
        })
        return
      }

      // Phase 2: Orchestrator synthesis
      const orchestratorModel: OrchestratorModel = ORCHESTRATOR_MODELS[0]
      let synthesisResult: { synthesis: string; duration_ms: number; model: string }
      try {
        synthesisResult = await synthesize(
          pipeline.userContent,
          scoredResponses,
          openrouter_api_key,
          orchestratorModel,
          max_tokens,
        )
      } catch (err: any) {
        res.status(502).json({
          error: { message: `Orchestrator failed: ${err.message}`, type: 'upstream_error', code: 'orchestrator_failed' },
        })
        return
      }

      // STM on synthesis
      const { finalResponse, stmResult } = applySTMPost(synthesisResult.synthesis, stm_modules)
      const totalDuration = Date.now() - startTime
      const collectionDuration = totalDuration - synthesisResult.duration_ms

      // Dataset
      let datasetId: string | null = null
      if (contribute_to_dataset) {
        datasetId = addEntry({
          endpoint: '/v1/chat/completions',
          model: orchestratorModel, mode: 'consortium',
          messages: pipeline.normalizedMessages.filter(m => m.role !== 'system'),
          response: finalResponse,
          autotune: pipeline.autotuneResult ? { strategy, detected_context: pipeline.autotuneResult.detectedContext, confidence: pipeline.autotuneResult.confidence, params: pipeline.autotuneResult.params, reasoning: pipeline.autotuneResult.reasoning } : undefined,
          parseltongue: pipeline.parseltongueResult || undefined,
          stm: stmResult ? { modules_applied: stmResult.modules_applied } : undefined,
          ultraplinian: { tier: raceTier, models_queried: models, winner_model: orchestratorModel, all_scores: scoredResponses.map(r => ({ model: r.model, score: r.score, duration_ms: r.duration_ms, success: r.success })), total_duration_ms: totalDuration },
        })
      }

      // Metadata
      recordEvent({
        endpoint: '/v1/chat/completions',
        mode: 'consortium',
        tier: raceTier,
        stream: false,
        pipeline: {
          ces: pipeline.ces,
          autotune: !!pipeline.autotuneResult,
          parseltongue: !!pipeline.parseltongueResult,
          stm_modules: stm_modules || [],
          strategy: pipeline.strategy,
        },
        models_queried: models.length,
        models_succeeded: totalSucceeded,
        model_results: scoredResponses.map(r => ({
          model: r.model, score: r.score, duration_ms: r.duration_ms,
          success: r.success, content_length: r.content?.length || 0,
          error_type: categorizeError(r.error),
        })),
        winner: { model: orchestratorModel, score: 0, duration_ms: synthesisResult.duration_ms, content_length: finalResponse.length },
        total_duration_ms: totalDuration,
        response_length: finalResponse.length,
      })

      // Token estimates
      const promptText = pipeline.processedMessages.map(m => m.content).join(' ')
      const promptTokens = estimateTokens(promptText)
      const completionTokens = estimateTokens(finalResponse)

      // OpenAI-compatible response with consortium metadata
      res.json({
        id: completionId,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: `consortium/${raceTier}`,
        choices: [{
          index: 0,
          message: { role: 'assistant', content: finalResponse },
          finish_reason: 'stop',
        }],
        usage: {
          prompt_tokens: promptTokens,
          completion_tokens: completionTokens,
          total_tokens: promptTokens + completionTokens,
        },
        x_novaos: {
          mode: 'consortium',
          orchestrator: {
            model: synthesisResult.model,
            duration_ms: synthesisResult.duration_ms,
          },
          collection: {
            tier: raceTier,
            models_queried: models.length,
            models_succeeded: totalSucceeded,
            collection_duration_ms: collectionDuration,
            total_duration_ms: totalDuration,
            top_responses: scoredResponses.filter(r => r.success).slice(0, 5).map(r => ({
              model: r.model, score: r.score, duration_ms: r.duration_ms,
            })),
          },
          params_used: pipeline.finalParams,
          pipeline: {
            ces: pipeline.ces,
            autotune: pipeline.autotuneResult
              ? { detected_context: pipeline.autotuneResult.detectedContext, confidence: pipeline.autotuneResult.confidence, strategy: pipeline.strategy }
              : null,
            parseltongue: pipeline.parseltongueResult,
            stm: stmResult,
          },
          dataset: contribute_to_dataset ? { contributed: true, entry_id: datasetId } : { contributed: false },
        },
      })
      return
    }

    // ── Single-model path ─────────────────────────────────────────────
    // Run the NOVAOS pipeline
    const pipeline = runPipeline({
      messages, model, ces, custom_system_prompt,
      autotune, strategy, parseltongue,
      parseltongue_technique, parseltongue_intensity, stm_modules,
      temperature, top_p, top_k,
      frequency_penalty, presence_penalty, repetition_penalty,
    })

    // ── Streaming mode ────────────────────────────────────────────────
    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream')
      res.setHeader('Cache-Control', 'no-cache')
      res.setHeader('Connection', 'keep-alive')
      res.setHeader('X-Accel-Buffering', 'no')
      res.flushHeaders()

      const created = Math.floor(Date.now() / 1000)
      let fullContent = ''

      try {
        // Request streaming from OpenRouter
        const streamBody: Record<string, unknown> = {
          model,
          messages: pipeline.processedMessages,
          temperature: pipeline.finalParams.temperature,
          max_tokens,
          stream: true,
        }
        if (no_log) {
          streamBody.provider = { allow_fallbacks: false }
        }
        if (pipeline.finalParams.top_p !== undefined) streamBody.top_p = pipeline.finalParams.top_p
        if (pipeline.finalParams.top_k !== undefined) streamBody.top_k = pipeline.finalParams.top_k
        if (pipeline.finalParams.frequency_penalty !== undefined) streamBody.frequency_penalty = pipeline.finalParams.frequency_penalty
        if (pipeline.finalParams.presence_penalty !== undefined) streamBody.presence_penalty = pipeline.finalParams.presence_penalty
        if (pipeline.finalParams.repetition_penalty !== undefined) streamBody.repetition_penalty = pipeline.finalParams.repetition_penalty

        const upstreamRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openrouter_api_key}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://ces.local',
            'X-Title': 'Cognitive-Execution-System',
          },
          body: JSON.stringify(streamBody),
        })

        if (!upstreamRes.ok) {
          const errData = await upstreamRes.json().catch(() => ({}))
          const errMsg = (errData as any).error?.message || `Upstream error: ${upstreamRes.status}`
          const chunk = {
            id: completionId,
            object: 'chat.completion.chunk',
            created,
            model,
            choices: [{
              index: 0,
              delta: {},
              finish_reason: 'error',
            }],
            x_novaos: { error: errMsg },
          }
          res.write(`data: ${JSON.stringify(chunk)}\n\n`)
          res.write('data: [DONE]\n\n')
          res.end()
          return
        }

        const reader = upstreamRes.body?.getReader()
        if (!reader) {
          res.write('data: [DONE]\n\n')
          res.end()
          return
        }

        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) {
            // Process any trailing data left in the buffer after stream ends
            if (buffer.trim()) {
              const trailing = buffer.trim()
              if (trailing.startsWith('data: ') && trailing !== 'data: [DONE]') {
                try {
                  const json = JSON.parse(trailing.slice(6))
                  const content = json.choices?.[0]?.delta?.content
                  if (content) {
                    fullContent += content
                    const chunk = {
                      id: completionId,
                      object: 'chat.completion.chunk',
                      created,
                      model,
                      choices: [{ index: 0, delta: { content }, finish_reason: null }],
                    }
                    res.write(`data: ${JSON.stringify(chunk)}\n\n`)
                  }
                } catch {}
              }
            }
            break
          }

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed || trimmed === 'data: [DONE]') {
              if (trimmed === 'data: [DONE]') {
                // Apply STM to full content before sending final chunk
                const { finalResponse } = applySTMPost(fullContent, stm_modules)
                // If STM changed the content, send a correction chunk
                if (finalResponse !== fullContent) {
                  const correctionChunk = {
                    id: completionId,
                    object: 'chat.completion.chunk',
                    created,
                    model,
                    choices: [{
                      index: 0,
                      delta: {},
                      finish_reason: 'stop',
                    }],
                    x_novaos: {
                      stm_applied: true,
                      final_content: finalResponse,
                    },
                  }
                  res.write(`data: ${JSON.stringify(correctionChunk)}\n\n`)
                } else {
                  // Send standard stop chunk
                  const stopChunk = {
                    id: completionId,
                    object: 'chat.completion.chunk',
                    created,
                    model,
                    choices: [{
                      index: 0,
                      delta: {},
                      finish_reason: 'stop',
                    }],
                  }
                  res.write(`data: ${JSON.stringify(stopChunk)}\n\n`)
                }
                res.write('data: [DONE]\n\n')
              }
              continue
            }
            if (!trimmed.startsWith('data: ')) continue

            try {
              const json = JSON.parse(trimmed.slice(6))
              const content = json.choices?.[0]?.delta?.content
              if (content) {
                fullContent += content
                // Re-emit in our standard format with our ID
                const chunk = {
                  id: completionId,
                  object: 'chat.completion.chunk',
                  created,
                  model,
                  choices: [{
                    index: 0,
                    delta: { content },
                    finish_reason: null,
                  }],
                }
                res.write(`data: ${JSON.stringify(chunk)}\n\n`)
              }
            } catch {
              // Skip invalid JSON
            }
          }
        }

        reader.releaseLock()

        // Record metadata for streaming request
        recordEvent({
          endpoint: '/v1/chat/completions',
          mode: 'standard',
          stream: true,
          pipeline: {
            ces: pipeline.ces,
            autotune: !!pipeline.autotuneResult,
            parseltongue: !!pipeline.parseltongueResult,
            stm_modules: stm_modules || [],
            strategy: pipeline.strategy,
          },
          autotune: pipeline.autotuneResult
            ? { detected_context: pipeline.autotuneResult.detectedContext, confidence: pipeline.autotuneResult.confidence }
            : undefined,
          model,
          model_results: [{
            model, score: 0, duration_ms: Date.now() - startTime,
            success: true, content_length: fullContent.length,
          }],
          winner: { model, score: 0, duration_ms: Date.now() - startTime, content_length: fullContent.length },
          total_duration_ms: Date.now() - startTime,
          response_length: fullContent.length,
        })

        // Don't end the response here — it was already ended when we wrote [DONE]
        if (!res.writableEnded) res.end()
      } catch (err) {
        if (!res.writableEnded) {
          res.write('data: [DONE]\n\n')
          res.end()
        }
      }
      return
    }

    // ── Non-streaming mode ────────────────────────────────────────────
    const response = await sendMessage({
      messages: pipeline.processedMessages,
      model,
      apiKey: openrouter_api_key,
      noLog: Boolean(no_log),
      temperature: pipeline.finalParams.temperature,
      maxTokens: max_tokens,
      top_p: pipeline.finalParams.top_p,
      top_k: pipeline.finalParams.top_k,
      frequency_penalty: pipeline.finalParams.frequency_penalty,
      presence_penalty: pipeline.finalParams.presence_penalty,
      repetition_penalty: pipeline.finalParams.repetition_penalty,
    })

    // STM transforms
    const { finalResponse, stmResult } = applySTMPost(response, stm_modules)

    // Dataset collection (opt-in)
    let datasetId: string | null = null
    if (contribute_to_dataset) {
      datasetId = addEntry({
        endpoint: '/v1/chat/completions',
        model,
        mode: 'standard',
        messages: pipeline.normalizedMessages.filter(m => m.role !== 'system'),
        response: finalResponse,
        autotune: pipeline.autotuneResult
          ? {
              strategy,
              detected_context: pipeline.autotuneResult.detectedContext,
              confidence: pipeline.autotuneResult.confidence,
              params: pipeline.autotuneResult.params,
              reasoning: pipeline.autotuneResult.reasoning,
            }
          : undefined,
        parseltongue: pipeline.parseltongueResult || undefined,
        stm: stmResult ? { modules_applied: stmResult.modules_applied } : undefined,
      })
    }

    // ZDR Metadata
    recordEvent({
      endpoint: '/v1/chat/completions',
      mode: 'standard',
      stream: false,
      pipeline: {
        ces: pipeline.ces,
        autotune: !!pipeline.autotuneResult,
        parseltongue: !!pipeline.parseltongueResult,
        stm_modules: stm_modules || [],
        strategy: pipeline.strategy,
      },
      autotune: pipeline.autotuneResult
        ? { detected_context: pipeline.autotuneResult.detectedContext, confidence: pipeline.autotuneResult.confidence }
        : undefined,
      model,
      model_results: [{
        model, score: 0, duration_ms: Date.now() - startTime,
        success: true, content_length: finalResponse.length,
      }],
      winner: { model, score: 0, duration_ms: Date.now() - startTime, content_length: finalResponse.length },
      total_duration_ms: Date.now() - startTime,
      response_length: finalResponse.length,
    })

    // Estimate tokens
    const promptText = pipeline.processedMessages.map(m => m.content).join(' ')
    const promptTokens = estimateTokens(promptText)
    const completionTokens = estimateTokens(finalResponse)

    // ── OpenAI-compatible response ────────────────────────────────────
    res.json({
      id: completionId,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: finalResponse,
          },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: promptTokens + completionTokens,
      },
      // NOVAOS pipeline metadata (ignored by OpenAI SDKs, useful for power users)
      x_novaos: {
        params_used: pipeline.finalParams,
        pipeline: {
          ces: pipeline.ces,
          autotune: pipeline.autotuneResult
            ? {
                detected_context: pipeline.autotuneResult.detectedContext,
                confidence: pipeline.autotuneResult.confidence,
                reasoning: pipeline.autotuneResult.reasoning,
                strategy: pipeline.strategy,
              }
            : null,
          parseltongue: pipeline.parseltongueResult,
          stm: stmResult,
        },
        dataset: contribute_to_dataset
          ? { contributed: true, entry_id: datasetId }
          : { contributed: false },
      },
    })
  } catch (err: any) {
    console.error('[chat]', err)
    const msg = err?.message || 'Internal server error'
    const isUpstream =
      msg.toLowerCase().includes('api error') ||
      msg.toLowerCase().includes('openrouter') ||
      msg.toLowerCase().includes('credits') ||
      msg.toLowerCase().includes('rate limit')
    const status = isUpstream ? 502 : 500
    res.status(status).json({
      error: {
        message: msg,
        type: status === 502 ? 'upstream_error' : 'server_error',
        code: null,
      },
    })
  }
})
