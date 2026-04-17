export interface AgentInput {
  prompt: string
  mode: string
}

export interface AgentResult {
  agent: string
  content: string
  confidence: number
}

import { inferDeliverables, topKeywords, confidenceFromSignalCount } from './shared'

export async function runStrategist(input: AgentInput): Promise<AgentResult> {
  const keywords = topKeywords(input.prompt, 5)
  const deliverables = inferDeliverables(input.mode)
  const confidence = confidenceFromSignalCount(keywords.length, 0.72)

  return {
    agent: 'strategist',
    content: [
      `Strategic objective: maximize outcome quality for '${input.mode}' while keeping implementation modular and testable.`,
      `Priority signals: ${keywords.join(', ') || 'general execution'}.`,
      `Expected deliverables: ${deliverables.join(', ')}.`,
      'Milestones: scope -> architecture -> implementation -> validation -> handoff.'
    ].join('\n'),
    confidence
  }
}
