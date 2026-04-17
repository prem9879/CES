import type { AgentInput, AgentResult } from './strategist'
import { inferDeliverables, confidenceFromSignalCount } from './shared'

export async function runExecutor(input: AgentInput): Promise<AgentResult> {
  const deliverables = inferDeliverables(input.mode)
  const confidence = confidenceFromSignalCount(deliverables.length, 0.69)

  return {
    agent: 'executor',
    content: [
      `Execution sequence for '${input.mode}':`,
      '1) lock scope and acceptance criteria',
      '2) implement modular changes by layer',
      '3) run automated validation and fix regressions',
      `4) produce final artifacts: ${deliverables.join(', ')}`
    ].join('\n'),
    confidence
  }
}
