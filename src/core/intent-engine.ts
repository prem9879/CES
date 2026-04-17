export type CESIntent = 'build' | 'research' | 'debug' | 'decide' | 'automate' | 'chat'

export interface IntentResult {
  intent: CESIntent
  confidence: number
  rationale: string
  keywords: string[]
}

const INTENT_KEYWORDS: Record<CESIntent, string[]> = {
  build: ['build', 'generate', 'create app', 'scaffold', 'project', 'boilerplate'],
  research: ['research', 'compare', 'analyze', 'summarize', 'investigate', 'findings'],
  debug: ['debug', 'fix', 'error', 'stack trace', 'failing', 'bug'],
  decide: ['decide', 'choice', 'choose', 'rank', 'tradeoff', 'option'],
  automate: ['automate', 'workflow', 'schedule', 'pipeline', 'task', 'script'],
  chat: []
}

function normalize(input: string): string {
  return input.toLowerCase().trim()
}

export function classifyIntent(input: string): IntentResult {
  const message = normalize(input)
  let best: CESIntent = 'chat'
  let score = 0
  let matched: string[] = []

  ;(Object.keys(INTENT_KEYWORDS) as CESIntent[]).forEach((intent) => {
    const hits = INTENT_KEYWORDS[intent].filter((kw) => message.includes(kw))
    if (hits.length > score) {
      score = hits.length
      best = intent
      matched = hits
    }
  })

  if (score === 0) {
    return {
      intent: 'chat',
      confidence: 0.55,
      rationale: 'No explicit mode keywords found; defaulting to conversational mode.',
      keywords: []
    }
  }

  return {
    intent: best,
    confidence: Math.min(0.99, 0.65 + score * 0.08),
    rationale: `Matched ${score} intent signals for ${best}.`,
    keywords: matched
  }
}
