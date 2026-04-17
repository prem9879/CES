export interface AgentOutput {
  agent: string
  content: string
  confidence: number
}

export interface FusionResult {
  merged: string
  summary: string
  consensus: string
}

export function fuseAgentOutputs(outputs: AgentOutput[]): FusionResult {
  if (outputs.length === 0) {
    return {
      merged: 'No agent outputs were produced.',
      summary: 'FusionEngine received zero outputs.',
      consensus: 'No consensus could be formed.'
    }
  }

  const sorted = [...outputs].sort((a, b) => b.confidence - a.confidence)
  const summary = sorted.map((o) => `${o.agent}:${o.confidence.toFixed(2)}`).join(' | ')
  const merged = sorted.map((o, idx) => `## ${idx + 1}. ${o.agent}\n${o.content}`).join('\n\n')
  const consensus = [
    `Top contributor: ${sorted[0].agent} (${sorted[0].confidence.toFixed(2)})`,
    `Lowest confidence: ${sorted[sorted.length - 1].agent} (${sorted[sorted.length - 1].confidence.toFixed(2)})`,
    'Consensus rule: prioritize high-confidence actions while preserving risk notes from critic outputs.'
  ].join(' | ')

  return { merged, summary, consensus }
}
