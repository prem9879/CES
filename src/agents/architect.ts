import type { AgentInput, AgentResult } from './strategist'
import { inferStack, confidenceFromSignalCount } from './shared'

export async function runArchitect(input: AgentInput): Promise<AgentResult> {
  const stack = inferStack(input.prompt)
  const confidence = confidenceFromSignalCount(stack.length, 0.7)

  return {
    agent: 'architect',
    content: [
      `Architecture proposal for '${input.mode}':`,
      `- Recommended stack: ${stack.join(' + ')}`,
      '- Boundaries: core engines, API routes, state/store, UI composition, and telemetry.',
      '- Rules: pure core logic, side-effects at boundaries, typed contracts between layers.'
    ].join('\n'),
    confidence
  }
}
