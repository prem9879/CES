/**
 * CES API Server
 *
 * Exposes the core engines (AutoTune, Parseltongue, STM, Feedback Loop)
 * and the flagship multi-model race mode as a REST API.
 *
 * Includes opt-in dataset collection for building an open source research dataset.
 * Enterprise paywall: tier-based access control (free/pro/enterprise).
 *
 * Designed for deployment on Hugging Face Spaces (Docker) or any container host.
 */

import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { rateLimit } from './middleware/rateLimit'
import { apiKeyAuth } from './middleware/auth'
import { tierGate } from './middleware/tierGate'
import { autotuneRoutes } from './routes/autotune'
import { parseltongueRoutes } from './routes/parseltongue'
import { transformRoutes } from './routes/transform'
import { chatRoutes } from './routes/chat'
import { feedbackRoutes } from './routes/feedback'
import { ultraplinianRoutes } from './routes/ultraplinian'
import { consortiumRoutes } from './routes/consortium'
import { datasetRoutes } from './routes/dataset'
import { metadataRoutes } from './routes/metadata'
import { researchRoutes } from './routes/research'
import { webSpecRoutes } from './routes/webspec'
import { authRoutes } from './routes/auth'
import { billingRoutes } from './routes/billing'
import { opsRoutes } from './routes/ops'
import { cesChatRoutes } from './routes/ces/chat'
import { cesBuildRoutes } from './routes/ces/build'
import { cesDecisionRoutes } from './routes/ces/decision'
import { cesMemoryRoutes } from './routes/ces/memory'
import { isPublisherEnabled, startPeriodicFlush, shutdownFlush, getPublisherStatus } from './lib/hf-publisher'
import { TIER_CONFIGS } from './lib/tiers'
import { ULTRAPLINIAN_MODELS } from './lib/ultraplinian'
import type { TierConfig } from './lib/tiers'

const app = express()
const PORT = parseInt(process.env.PORT || '7860', 10) // HF Spaces default

// ── Middleware ─────────────────────────────────────────────────────────
// CORS: Allow configured origins. When self-hosting, set CORS_ORIGIN=* to allow all.
const corsOrigins = process.env.CORS_ORIGIN === '*'
  ? true  // Allow all origins (self-hosted / behind reverse proxy)
  : [process.env.CORS_ORIGIN || 'http://localhost:3000', ...(process.env.HF_SPACE_URL ? [process.env.HF_SPACE_URL] : [])].filter(Boolean)
app.use(cors({ origin: corsOrigins, credentials: false }))

// Security headers via helmet
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'none'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ['https://fonts.gstatic.com'],
      connectSrc: ["'self'", 'https://openrouter.ai', 'https://*.openrouter.ai', 'https://*.huggingface.co'],
      imgSrc: ["'self'", 'data:', 'blob:'],
      baseUri: ["'none'"],
      formAction: ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
  crossOriginOpenerPolicy: { policy: 'same-origin' },
  crossOriginResourcePolicy: { policy: 'same-origin' },
  frameguard: { action: 'deny' },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  permittedCrossDomainPolicies: false,
  xXssProtection: false, // X-XSS-Protection: 0 (modern best practice — CSP replaces it)
}))

// Permissions-Policy (not covered by helmet)
app.use((_req, res, next) => {
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()')
  next()
})

app.use(express.json({
  limit: '12mb',
  verify: (req, _res, buf) => {
    ;(req as { rawBody?: Buffer }).rawBody = Buffer.from(buf)
  },
}))

// ── Health / Info (no auth required) ──────────────────────────────────
app.get('/v1/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() })
})

app.get('/v1/info', (_req, res) => {
  res.json({
    name: 'Cognitive Execution System (CES) API',
    version: '0.4.0',
    description: 'Cognitive Execution System (CES) multi-model race mode with live upgrades, context-adaptive parameter tuning, text transformation, obfuscation, opt-in open dataset collection, and full research APIs for querying published corpora.',
    license: 'AGPL-3.0',
    flagship: 'POST /v1/ultraplinian/completions',
    consortium: 'POST /v1/consortium/completions',
    defaults: {
      stream: true,
      liquid_min_delta: 8,
      note: 'Streaming (Liquid Response) is ON by default. The first good response is served immediately via SSE, then auto-upgraded when a better model beats the current leader by liquid_min_delta score points.',
    },
    tiers: {
      free: { label: 'Free', limits: TIER_CONFIGS.free.rateLimit, ultraplinian: TIER_CONFIGS.free.ultraplinianTiers, research: TIER_CONFIGS.free.researchAccess },
      pro: { label: 'Pro', limits: TIER_CONFIGS.pro.rateLimit, ultraplinian: TIER_CONFIGS.pro.ultraplinianTiers, research: TIER_CONFIGS.pro.researchAccess },
      enterprise: { label: 'Enterprise', limits: TIER_CONFIGS.enterprise.rateLimit, ultraplinian: TIER_CONFIGS.enterprise.ultraplinianTiers, research: TIER_CONFIGS.enterprise.researchAccess },
    },
    endpoints: {
      'GET  /v1/tier': 'Check your current tier, limits, and feature access',
      'POST /v1/ultraplinian/completions': 'Compatibility race endpoint: run N models in parallel with Liquid Response (stream=true default), serve the first good response immediately, then auto-upgrade live.',
      'POST /v1/consortium/completions': 'CONSORTIUM: Collect ALL model responses, orchestrator synthesizes ground truth from collective intelligence.',
      'POST /v1/chat/completions': 'Single-model pipeline with Cognitive Execution System (CES) + AutoTune + Parseltongue + STM. Also supports model="ultraplinian/*" and model="consortium/*" virtual models.',
      'POST /v1/autotune/analyze': 'Analyze message context and compute optimal LLM parameters',
      'POST /v1/parseltongue/encode': 'Obfuscate trigger words in text',
      'POST /v1/parseltongue/detect': 'Detect trigger words in text',
      'POST /v1/transform': 'Apply semantic transformation modules to text',
      'POST /v1/feedback': 'Submit quality feedback for the EMA learning loop',
      'GET  /v1/dataset/stats': 'Dataset collection statistics (Pro+)',
      'GET  /v1/dataset/export': 'Export the open research dataset (Pro+)',
      'GET  /v1/metadata/stats': 'ZDR usage analytics (models, latency, pipeline stats — no content)',
      'GET  /v1/metadata/events': 'Raw metadata event log (Enterprise only)',
      'GET  /v1/research/info': 'Research dataset schema, repo info (Pro+)',
      'GET  /v1/research/stats': 'Aggregate stats across all published HF batches (Pro+)',
      'GET  /v1/research/batches': 'List all published batch files (Pro+)',
      'GET  /v1/research/batch/*': 'Read a specific batch file (Pro+)',
      'GET  /v1/research/query': 'Query the full corpus with filters (Enterprise)',
      'POST /v1/research/flush': 'Force-flush in-memory buffers to HuggingFace (Enterprise)',
      'GET  /v1/research/download': 'Download full corpus as streaming JSONL (Enterprise)',
      'GET  /v1/research/combined-stats': 'Combined in-memory + published stats (Pro+)',
      'POST /v1/ces/chat': 'Cognitive Execution System (CES) pipeline chat: intent -> mode -> agents -> fusion -> decision -> execution',
      'POST /v1/ces/build': 'Cognitive Execution System (CES) build pipeline response with structured artifacts',
      'POST /v1/ces/decision': 'Cognitive Execution System (CES) decision ranking for multiple options',
      'POST /v1/ces/memory/analyze': 'Cognitive Execution System (CES) memory graph ranking for prompt-context retrieval',
      'POST /v1/auth/register': 'Email/password registration',
      'POST /v1/auth/login': 'Email/password login (JWT access + refresh tokens)',
      'POST /v1/auth/refresh': 'Refresh JWT access token',
      'POST /v1/auth/oauth/google': 'Google OAuth login (requires provider setup)',
      'POST /v1/billing/checkout': 'Create Stripe checkout session (Free/Pro/Enterprise)',
    },
    authentication: {
      openrouter_key: process.env.OPENROUTER_API_KEY
        ? 'Server-provided (callers do NOT need their own OpenRouter key)'
        : 'Caller must provide openrouter_api_key in request body',
      api_key: 'Send Authorization: Bearer <your-api-key> (if server has Cognitive Execution System (CES)_API_KEY set)',
      tier_assignment: 'Set Cognitive Execution System (CES)_TIER_KEYS="enterprise:key1,pro:key2" to assign tiers to keys',
    },
    dataset: {
      note: 'Opt-in per request via contribute_to_dataset: true. No PII stored. Exportable as JSONL for HuggingFace Datasets.',
    },
    auto_publish: getPublisherStatus(),
    source: 'https://github.com/your-org/Cognitive Execution System (CES)',
  })
})

// ── Models Endpoint (OpenAI-compatible) ───────────────────────────────
// Enterprise users need this for SDK model discovery

app.get('/v1/models', (_req, res) => {
  const allModels = [
    ...ULTRAPLINIAN_MODELS.fast,
    ...ULTRAPLINIAN_MODELS.standard,
    ...ULTRAPLINIAN_MODELS.smart,
    ...ULTRAPLINIAN_MODELS.power,
    ...ULTRAPLINIAN_MODELS.ultra,
  ]

  const created = Math.floor(Date.now() / 1000)

  // Virtual race models — race N models, return the best
  const virtualModels = [
    { id: 'ultraplinian/fast', owned_by: 'Cognitive Execution System (CES)' },
    { id: 'ultraplinian/standard', owned_by: 'Cognitive Execution System (CES)' },
    { id: 'ultraplinian/smart', owned_by: 'Cognitive Execution System (CES)' },
    { id: 'ultraplinian/power', owned_by: 'Cognitive Execution System (CES)' },
    { id: 'ultraplinian/ultra', owned_by: 'Cognitive Execution System (CES)' },
    // CONSORTIUM — hive-mind synthesis from all models
    { id: 'consortium/fast', owned_by: 'Cognitive Execution System (CES)' },
    { id: 'consortium/standard', owned_by: 'Cognitive Execution System (CES)' },
    { id: 'consortium/smart', owned_by: 'Cognitive Execution System (CES)' },
    { id: 'consortium/power', owned_by: 'Cognitive Execution System (CES)' },
    { id: 'consortium/ultra', owned_by: 'Cognitive Execution System (CES)' },
  ]

  res.json({
    object: 'list',
    data: [
      // Virtual ULTRAPLINIAN models first
      ...virtualModels.map(m => ({
        id: m.id,
        object: 'model' as const,
        created,
        owned_by: m.owned_by,
      })),
      // Individual models
      ...allModels.map(id => ({
        id,
        object: 'model' as const,
        created,
        owned_by: id.split('/')[0] || 'unknown',
      })),
    ],
  })
})

// ── Tier Info Endpoint (authenticated) ────────────────────────────────
app.get('/v1/tier', apiKeyAuth, (req, res) => {
  const tier = req.tier || 'free'
  const config: TierConfig = req.tierConfig || TIER_CONFIGS.free
  res.json({
    tier: config.name,
    label: config.label,
    limits: config.rateLimit,
    features: {
      ultraplinian_tiers: config.ultraplinianTiers,
      max_race_models: config.maxRaceModels,
      research_access: config.researchAccess,
      dataset_export_formats: config.datasetExportFormats,
      can_flush: config.canFlush,
      can_access_metadata_events: config.canAccessMetadataEvents,
      can_download_corpus: config.canDownloadCorpus,
    },
    upgrade: tier !== 'enterprise'
      ? 'Contact sales or set Cognitive Execution System (CES)_TIER_KEYS to upgrade your API key tier.'
      : undefined,
  })
})

// ── Core routes (all tiers) ───────────────────────────────────────────
app.use('/v1/ultraplinian', apiKeyAuth, rateLimit, ultraplinianRoutes)
app.use('/v1/consortium', apiKeyAuth, rateLimit, consortiumRoutes)
app.use('/v1/chat', apiKeyAuth, rateLimit, chatRoutes)
app.use('/v1/auth', rateLimit, authRoutes)
app.use('/v1/billing', rateLimit, billingRoutes)
app.use('/v1/ops', rateLimit, opsRoutes)
app.use('/v1/autotune', apiKeyAuth, rateLimit, autotuneRoutes)
app.use('/v1/parseltongue', apiKeyAuth, rateLimit, parseltongueRoutes)
app.use('/v1/transform', apiKeyAuth, rateLimit, transformRoutes)
app.use('/v1/feedback', apiKeyAuth, rateLimit, feedbackRoutes)
app.use('/v1/ces/chat', apiKeyAuth, rateLimit, cesChatRoutes)
app.use('/v1/ces/build', apiKeyAuth, rateLimit, cesBuildRoutes)
app.use('/v1/ces/decision', apiKeyAuth, rateLimit, cesDecisionRoutes)
app.use('/v1/ces/memory', apiKeyAuth, rateLimit, cesMemoryRoutes)
app.use('/v1/chat', apiKeyAuth, rateLimit, webSpecRoutes)

// ── Gated routes ──────────────────────────────────────────────────────
// Dataset: Pro+ for export, stats accessible by all
app.use('/v1/dataset', apiKeyAuth, rateLimit, tierGate('dataset:export'), datasetRoutes)

// Metadata: stats open to all auth'd users, events gated to Enterprise
app.use('/v1/metadata', apiKeyAuth, metadataRoutes) // individual route-level gating in metadata routes

// Research: Pro+ for read access, Enterprise for full access
app.use('/v1/research', apiKeyAuth, rateLimit, tierGate('research:read'), researchRoutes)

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

function normalizeWeatherLocation(location: string): string {
  return location
    .replace(/\b(today|tomorrow|tonight|now|currently|this week|this weekend)\b.*$/i, '')
    .replace(/\b(weather|forecast|temperature|conditions?)\b.*$/i, '')
    .replace(/[?.!,]+$/g, '')
    .trim()
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

async function lookupWeatherSummary(query: string): Promise<string | null> {
  const explicitLocation = extractWeatherLocation(query)
  let locationLabel = explicitLocation || ''
  let latitude: number | null = null
  let longitude: number | null = null

  if (explicitLocation) {
    const normalizedLocation = normalizeWeatherLocation(explicitLocation)
    try {
      const geo = await fetchJson<{ results?: Array<{ name: string; country?: string; admin1?: string; latitude: number; longitude: number }> }>(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(normalizedLocation)}&count=1&language=en&format=json`,
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
    const approx = await fetchJson<{ success: boolean; city?: string; region?: string; country?: string; latitude?: number; longitude?: number }>('https://ipwho.is/?output=json', 5000)
    if (!approx.success || typeof approx.latitude !== 'number' || typeof approx.longitude !== 'number') {
      return null
    }
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

  lines.push('If you want a different city, tell me the location and I’ll refresh it live.')
  return lines.join(' ')
}

app.post('/v1/chat/live-weather', async (req, res) => {
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

// ── 404 ───────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found. See GET /v1/info for available endpoints.' })
})

// ── Error handler ─────────────────────────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[API Error]', err.message)
  res.status(500).json({ error: 'Internal server error' })
})

// ── Start ─────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  const hfStatus = isPublisherEnabled()
    ? `ON → ${process.env.HF_DATASET_REPO}`
    : 'OFF (set HF_TOKEN + HF_DATASET_REPO to enable)'

  console.log(`
  ╔══════════════════════════════════════════════════════════╗
  ║  Cognitive Execution System (CES) API v0.4.0                                      ║
  ║  Listening on http://0.0.0.0:${PORT}                       ║
  ║                                                          ║
  ║  TIERS:                                                  ║
  ║  FREE        5 req total, 10/min, 50/day                ║
  ║  PRO         unlimited, 60/min, 1000/day                ║
  ║  ENTERPRISE  unlimited, 300/min, 10000/day              ║
  ║                                                          ║
  ║  FLAGSHIP:                                               ║
  ║  POST /v1/ultraplinian/completions  Multi-model racing   ║
  ║  POST /v1/consortium/completions    Hive-mind synthesis  ║
  ║                                                          ║
  ║  ENGINES (all tiers):                                    ║
  ║  POST /v1/chat/completions     Single-model + Cognitive Execution System (CES)    ║
  ║  POST /v1/autotune/analyze     Context analysis          ║
  ║  POST /v1/parseltongue/encode  Text obfuscation          ║
  ║  POST /v1/transform            STM transforms            ║
  ║  POST /v1/feedback             Feedback loop             ║
  ║                                                          ║
  ║  GATED (Pro+):                                           ║
  ║  GET  /v1/dataset/export       Export dataset             ║
  ║  GET  /v1/research/stats       Published corpus stats    ║
  ║  GET  /v1/research/batches     List HF batch files       ║
  ║                                                          ║
  ║  GATED (Enterprise):                                     ║
  ║  GET  /v1/research/query       Query full corpus         ║
  ║  GET  /v1/research/download    Download corpus (JSONL)   ║
  ║  POST /v1/research/flush       Force-flush to HF         ║
  ║  GET  /v1/metadata/events      Raw metadata event log    ║
  ║                                                          ║
  ║  TIER CHECK:                                             ║
  ║  GET  /v1/tier                 Your tier + limits        ║
  ║                                                          ║
  ║  AUTO-PUBLISH: ${hfStatus.padEnd(39)}║
  ╚══════════════════════════════════════════════════════════╝
  `)

  if (!(process.env.CES_API_KEY || process.env.CES_API_KEYS || process.env.CES_API_KEY || process.env.CES_API_KEYS)) {
    console.warn('  ⚠  WARNING: No Cognitive Execution System (CES)_API_KEY or Cognitive Execution System (CES)_API_KEYS set (legacy CES_* also supported) — all routes are unauthenticated!')
  }

  if (!(process.env.CES_TIER_KEYS || process.env.CES_TIER_KEYS)) {
    console.warn('  ⚠  WARNING: No Cognitive Execution System (CES)_TIER_KEYS set (legacy CES_TIER_KEYS also supported) — all keys default to free tier')
  }

  if (!process.env.HF_TOKEN) {
    console.warn('  ⚠  WARNING: HF_TOKEN not set — auto-publish to HuggingFace is DISABLED')
  } else if (!process.env.HF_DATASET_REPO) {
    console.warn('  ⚠  WARNING: HF_DATASET_REPO not set — auto-publish to HuggingFace is DISABLED (token is set but no target repo)')
  }

  // Start periodic HF flush (no-op if not configured)
  startPeriodicFlush()
})

// ── Graceful Shutdown ─────────────────────────────────────────────────
// Flush remaining metadata/dataset to HF before the container dies

async function gracefulShutdown(signal: string) {
  console.log(`\n[${signal}] Shutting down...`)
  await shutdownFlush()
  process.exit(0)
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.on('SIGINT', () => gracefulShutdown('SIGINT'))

export default app
