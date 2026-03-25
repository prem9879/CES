/**
 * G0DM0D3 Gemini Proxy — Cloudflare Pages Function
 *
 * Proxies chat completion requests to Google's Gemini API using a
 * server-side API key (free tier). The key lives in CF Pages
 * environment variables — never exposed to the browser.
 *
 * URL: POST /api/gemini
 *
 * Setup (Cloudflare Pages Dashboard → Settings → Environment Variables):
 *   GEMINI_API_KEY  — Google AI Studio API key (from https://aistudio.google.com/apikey)
 *
 * The frontend sends an OpenAI-compatible request body. This function
 * translates it to the Gemini generateContent API format and returns
 * the response in OpenAI-compatible format so the frontend can parse
 * it the same way it parses OpenRouter responses.
 */

interface Env {
  GEMINI_API_KEY: string
}

// CORS headers
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
}

// ── Rate Limiter (in-memory, per-isolate) ────────────────────────────
const RATE_LIMIT_WINDOW_MS = 60_000 // 1 minute
const RATE_LIMIT_MAX = 5            // max 5 requests/min per IP
const rateLimitMap = new Map<string, number[]>()

function isRateLimited(key: string): boolean {
  const now = Date.now()
  let timestamps = rateLimitMap.get(key)

  if (!timestamps) {
    timestamps = []
    rateLimitMap.set(key, timestamps)
  }

  const cutoff = now - RATE_LIMIT_WINDOW_MS
  while (timestamps.length > 0 && timestamps[0] <= cutoff) {
    timestamps.shift()
  }

  if (timestamps.length >= RATE_LIMIT_MAX) {
    return true
  }

  timestamps.push(now)
  return false
}

// ── Gemini API translation ───────────────────────────────────────────

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface GeminiContent {
  role: 'user' | 'model'
  parts: { text: string }[]
}

/**
 * Convert OpenAI-style messages to Gemini generateContent format.
 * System messages become systemInstruction; user/assistant map to
 * user/model roles.
 */
function toGeminiRequest(
  messages: OpenAIMessage[],
  opts: { maxTokens?: number; temperature?: number; topP?: number },
) {
  let systemInstruction: { parts: { text: string }[] } | undefined
  const contents: GeminiContent[] = []

  for (const msg of messages) {
    if (msg.role === 'system') {
      // Gemini supports a single systemInstruction; concat if multiple
      if (!systemInstruction) {
        systemInstruction = { parts: [{ text: msg.content }] }
      } else {
        systemInstruction.parts[0].text += '\n\n' + msg.content
      }
    } else {
      contents.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      })
    }
  }

  const request: Record<string, unknown> = { contents }

  if (systemInstruction) {
    request.systemInstruction = systemInstruction
  }

  const generationConfig: Record<string, unknown> = {}
  if (opts.maxTokens) generationConfig.maxOutputTokens = opts.maxTokens
  if (opts.temperature !== undefined) generationConfig.temperature = opts.temperature
  if (opts.topP !== undefined) generationConfig.topP = opts.topP

  if (Object.keys(generationConfig).length > 0) {
    request.generationConfig = generationConfig
  }

  // Disable thinking/reasoning — we want raw completions, not chain-of-thought
  request.generationConfig = {
    ...((request.generationConfig as Record<string, unknown>) || {}),
    thinkingConfig: { thinkingBudget: 0 },
  }

  // Disable all safety filters — G0DM0D3 handles content policy upstream
  request.safetySettings = [
    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_CIVIC_INTEGRITY', threshold: 'BLOCK_NONE' },
  ]

  return request
}

// Map of OpenRouter model IDs → Gemini model names
const MODEL_MAP: Record<string, string> = {
  'google/gemini-2.5-pro': 'gemini-2.5-pro',
  'google/gemini-2.5-flash': 'gemini-2.5-flash',
  'google/gemini-2.0-flash': 'gemini-2.0-flash',
}

// ── Handlers ─────────────────────────────────────────────────────────

export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context

  if (!env.GEMINI_API_KEY) {
    return jsonResponse({ error: 'Gemini proxy not configured (missing GEMINI_API_KEY)' }, 503)
  }

  // Rate limit by IP
  const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown'
  if (isRateLimited(clientIP)) {
    return jsonResponse({ error: 'Rate limit exceeded — try again later' }, 429)
  }

  // Parse request body (OpenAI-compatible format)
  let body: {
    model: string
    messages: OpenAIMessage[]
    max_tokens?: number
    temperature?: number
    top_p?: number
  }
  try {
    body = await request.json() as typeof body
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400)
  }

  if (!body.messages || !Array.isArray(body.messages)) {
    return jsonResponse({ error: 'Missing messages array' }, 400)
  }

  // Resolve Gemini model name
  const geminiModel = MODEL_MAP[body.model]
  if (!geminiModel) {
    return jsonResponse({ error: `Unsupported model: ${body.model}` }, 400)
  }

  // Build Gemini request
  const geminiBody = toGeminiRequest(body.messages, {
    maxTokens: body.max_tokens,
    temperature: body.temperature,
    topP: body.top_p,
  })

  // Call Gemini API
  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${env.GEMINI_API_KEY}`

  try {
    const geminiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiBody),
    })

    if (!geminiRes.ok) {
      const errText = await geminiRes.text().catch(() => '')
      console.error(`[Gemini] API error ${geminiRes.status}: ${errText.slice(0, 500)}`)
      return jsonResponse(
        { error: `Gemini API error (${geminiRes.status})`, detail: errText.slice(0, 300) },
        geminiRes.status >= 500 ? 502 : geminiRes.status,
      )
    }

    const geminiData = await geminiRes.json() as {
      candidates?: { content?: { parts?: { text?: string }[] } }[]
    }

    // Extract response text
    const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || ''

    // Return in OpenAI-compatible format so the frontend can parse it identically
    return jsonResponse({
      id: `gemini-${Date.now()}`,
      object: 'chat.completion',
      model: body.model,
      choices: [{
        index: 0,
        message: { role: 'assistant', content: text },
        finish_reason: 'stop',
      }],
    }, 200)

  } catch (err) {
    console.error('[Gemini] Network error:', err)
    return jsonResponse({ error: 'Failed to reach Gemini API' }, 502)
  }
}

// ── Helpers ──────────────────────────────────────────────────────────

function jsonResponse(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS,
    },
  })
}
