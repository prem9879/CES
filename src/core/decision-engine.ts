import { scoreCandidate, type ScoringBreakdown } from '@/services/scoring'

export interface DecisionCandidate {
  id: string
  source: string
  content: string
}

export interface DecisionResult {
  winner: DecisionCandidate & { score: number; breakdown: ScoringBreakdown }
  ranked: Array<DecisionCandidate & { score: number; breakdown: ScoringBreakdown }>
  criteria: string[]
  rationale: string
}

export function selectBestCandidate(candidates: DecisionCandidate[], userPrompt: string): DecisionResult {
  if (candidates.length === 0) {
    throw new Error('DecisionEngine received no candidates.')
  }

  const ranked = candidates
    .map((candidate) => {
      const breakdown = scoreCandidate(candidate.content, userPrompt)
      return {
        ...candidate,
        score: breakdown.total,
        breakdown
      }
    })
    .sort((a, b) => b.score - a.score)

  const winner = ranked[0]
  const runnerUp = ranked[1]
  const delta = runnerUp ? (winner.score - runnerUp.score).toFixed(2) : 'n/a'

  return {
    winner,
    ranked,
    criteria: ['clarity', 'actionability', 'completeness', 'prompt alignment'],
    rationale: runnerUp
      ? `Selected ${winner.source} over ${runnerUp.source} with score delta ${delta}.`
      : `Selected ${winner.source} as the only available candidate.`
  }
}
