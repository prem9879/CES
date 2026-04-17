import type { WebSpecCitation } from '@/types/webspec'

const TRUSTED_SOURCE_HOSTS = [
  'apple.com',
  'developer.apple.com',
  'support.apple.com',
  'samsung.com',
  'developer.android.com',
  'support.google.com',
  'w3.org',
  'whatwg.org',
  'rfc-editor.org',
  'datatracker.ietf.org',
  'learn.microsoft.com',
  'docs.microsoft.com',
  'developer.mozilla.org',
  'web.dev',
  'react.dev',
  'nextjs.org',
  'nodejs.org',
  'docs.openai.com',
  'platform.openai.com',
  'openrouter.ai',
] as const

const TRUSTED_SOURCE_HINTS: Array<{ pattern: RegExp; sources: string[] }> = [
  {
    pattern: /\b(iphone|ios|apple|macbook|ipad)\b/i,
    sources: [
      'https://www.apple.com/iphone/',
      'https://support.apple.com/iphone',
      'https://developer.apple.com/documentation/',
    ],
  },
  {
    pattern: /\b(samsung|galaxy|android|pixel)\b/i,
    sources: [
      'https://www.samsung.com/global/galaxy/',
      'https://developer.android.com/',
      'https://support.google.com/android/',
    ],
  },
  {
    pattern: /\b(spec|specification|web standards?|html|css|javascript|typescript|react|next\.js|nextjs)\b/i,
    sources: [
      'https://developer.mozilla.org/',
      'https://www.w3.org/',
      'https://whatwg.org/',
      'https://react.dev/',
      'https://nextjs.org/docs',
    ],
  },
  {
    pattern: /\b(api|sdk|auth|openrouter|openai|model)\b/i,
    sources: [
      'https://platform.openai.com/docs',
      'https://docs.openai.com/',
      'https://openrouter.ai/docs',
    ],
  },
  {
    pattern: /\b(rfc|internet standard|protocol|ietf)\b/i,
    sources: [
      'https://www.rfc-editor.org/',
      'https://datatracker.ietf.org/',
    ],
  },
]

function normalizeHostname(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./, '')
}

function isTrustedHost(hostname: string): boolean {
  const normalized = normalizeHostname(hostname)
  return TRUSTED_SOURCE_HOSTS.some((trustedHost) => {
    const trusted = normalizeHostname(trustedHost)
    return normalized === trusted || normalized.endsWith(`.${trusted}`)
  })
}

export function normalizeTrustedSourceUrl(input: string): URL | null {
  try {
    const url = new URL(input)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    if (!isTrustedHost(url.hostname)) return null
    url.hash = ''
    return url
  } catch {
    return null
  }
}

export function suggestTrustedSources(query: string): string[] {
  const matches = TRUSTED_SOURCE_HINTS.filter((hint) => hint.pattern.test(query))
  return Array.from(new Set(matches.flatMap((hint) => hint.sources)))
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
}

function stripHtml(html: string): string {
  const withoutScripts = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<head[\s\S]*?<\/head>/gi, ' ')

  const withBreaks = withoutScripts
    .replace(/<(?:\s*\/)?(?:p|div|section|article|header|footer|main|aside|nav|li|ul|ol|table|tr|td|th|blockquote|h[1-6]|br|hr)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')

  return decodeHtmlEntities(withBreaks.replace(/\s+/g, ' ').trim())
}

function extractTitle(html: string, fallbackUrl: URL): string {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  if (titleMatch?.[1]) return decodeHtmlEntities(titleMatch[1].trim())

  const ogTitleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)
  if (ogTitleMatch?.[1]) return decodeHtmlEntities(ogTitleMatch[1].trim())

  return fallbackUrl.hostname.replace(/^www\./, '')
}

function extractKind(url: URL): WebSpecCitation['kind'] {
  const specHints = ['spec', 'docs', 'developer', 'rfc', 'whatwg', 'w3']
  return specHints.some((hint) => url.hostname.includes(hint) || url.pathname.toLowerCase().includes(hint)) ? 'spec' : 'web'
}

function buildSnippet(text: string, query: string, maxLength = 420): string {
  const keywords = Array.from(new Set(
    query.toLowerCase()
      .split(/[^a-z0-9]+/i)
      .map((word) => word.trim())
      .filter((word) => word.length >= 4)
      .slice(0, 6),
  ))

  let start = 0
  for (const keyword of keywords) {
    const index = text.toLowerCase().indexOf(keyword)
    if (index >= 0) {
      start = Math.max(0, index - 120)
      break
    }
  }

  const snippet = text.slice(start, start + maxLength).trim()
  return snippet || text.slice(0, maxLength).trim()
}

async function fetchTrustedHtmlWithTimeout(url: URL, signal?: AbortSignal, timeoutMs = 8000): Promise<string> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  const abortListener = () => controller.abort()

  if (signal) {
    if (signal.aborted) {
      controller.abort()
    } else {
      signal.addEventListener('abort', abortListener, { once: true })
    }
  }

  try {
    const response = await fetch(url.toString(), {
      signal: controller.signal,
      headers: {
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    })

    if (!response.ok) {
      throw new Error(`Request failed (${response.status})`)
    }

    return await response.text()
  } finally {
    clearTimeout(timeout)
    if (signal) {
      signal.removeEventListener('abort', abortListener)
    }
  }
}

export function buildCitationContextBlock(query: string, citations: WebSpecCitation[]): string {
  if (citations.length === 0) return ''

  const lines = [
    '[TRUSTED_SOURCES]',
    `Query: ${query}`,
    'Use the numbered citations inline and keep the final answer grounded in the fetched sources.',
  ]

  citations.forEach((citation, index) => {
    lines.push(
      `${index + 1}. ${citation.title}`,
      `URL: ${citation.url}`,
      `Source: ${citation.domain} (${citation.kind})`,
      `Excerpt: ${citation.snippet}`,
    )
  })

  return lines.join('\n')
}

export async function fetchTrustedSourceCitations(input: {
  query: string
  sources?: string[]
  signal?: AbortSignal
  limit?: number
}): Promise<{ citations: WebSpecCitation[]; context: string; sourcesUsed: string[] }> {
  const query = input.query.trim()
  const sources = (input.sources && input.sources.length > 0 ? input.sources : suggestTrustedSources(query)).slice(0, input.limit || 4)

  const citations: WebSpecCitation[] = []
  const sourcesUsed: string[] = []

  for (const rawSource of sources) {
    const url = normalizeTrustedSourceUrl(rawSource)
    if (!url) {
      continue
    }

    try {
      const html = await fetchTrustedHtmlWithTimeout(url, input.signal)
      const title = extractTitle(html, url)
      const text = stripHtml(html)
      const snippet = buildSnippet(text, query)

      citations.push({
        title,
        url: url.toString(),
        domain: normalizeHostname(url.hostname),
        snippet,
        fetchedAt: Date.now(),
        kind: extractKind(url),
      })
      sourcesUsed.push(url.toString())
    } catch {
      continue
    }
  }

  return {
    citations,
    context: buildCitationContextBlock(query, citations),
    sourcesUsed,
  }
}
