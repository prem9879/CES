import type { AgentInput, AgentResult } from './strategist'
import { topKeywords, confidenceFromSignalCount } from './shared'

export async function runCritic(input: AgentInput): Promise<AgentResult> {
  const keywords = topKeywords(input.prompt, 3)
  const confidence = confidenceFromSignalCount(keywords.length, 0.66)

  return {
    agent: 'critic',
    content: [
      `Risk review for '${input.mode}':`,
      '- Main risks: vague scope, over-broad implementation, and unvalidated assumptions.',
      `- Watch list: ${keywords.join(', ') || 'general quality gates'}.`,
      '- Mitigations: tighten contracts, keep diffs minimal, and validate with tests/build.'
    ].join('\n'),
    confidence
  }
}
