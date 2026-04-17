import type { AgentInput, AgentResult } from './strategist'
import { topKeywords, confidenceFromSignalCount } from './shared'

export async function runAnalyst(input: AgentInput): Promise<AgentResult> {
  const keywords = topKeywords(input.prompt, 4)
  const confidence = confidenceFromSignalCount(keywords.length, 0.68)

  return {
    agent: 'analyst',
    content: [
      'Analysis findings:',
      `- Key problem signals: ${keywords.join(', ') || 'none extracted'}`,
      '- Assumptions to verify: requirements completeness, runtime constraints, and acceptance criteria.',
      '- Verification targets: edge cases, failure paths, and measurable completion checks.'
    ].join('\n'),
    confidence
  }
}
