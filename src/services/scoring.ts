export interface ScoringBreakdown {
  relevance: number
  coverage: number
  clarity: number
  total: number
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

export function scoreCandidate(content: string, prompt: string): ScoringBreakdown {
  const promptTokens = prompt.toLowerCase().split(/\s+/).filter(Boolean)
  const contentLower = content.toLowerCase()

  const tokenHits = promptTokens.filter((t) => contentLower.includes(t)).length
  const relevance = clamp01(promptTokens.length === 0 ? 0.5 : tokenHits / promptTokens.length)
  const coverage = clamp01(Math.min(1, content.length / 1200))
  const sentenceCount = content.split(/[.!?]+/).filter(Boolean).length
  const clarity = clamp01(sentenceCount >= 2 ? 0.8 : 0.5)

  return {
    relevance,
    coverage,
    clarity,
    total: relevance * 0.5 + coverage * 0.3 + clarity * 0.2
  }
}
