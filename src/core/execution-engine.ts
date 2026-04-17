import type { CESMode } from './mode-router'
import { createResponseEvolution } from './response-evolution'
import { generateBuildBlueprint } from './build-generator'
import { formatStructuredSections } from './structured-output'

export interface ExecutionArtifacts {
  mode: CESMode
  plan: string[]
  files: Array<{ path: string; content: string }>
  tree: string[]
}

export interface ExecutionResult {
  draft: string
  refined: string
  final: string
  artifacts: ExecutionArtifacts
}

function buildDefaultPlan(mode: CESMode): string[] {
  switch (mode) {
    case 'build':
      return ['Define architecture', 'Generate project skeleton', 'Implement modules', 'Add tests and docs']
    case 'debug':
      return ['Reproduce issue', 'Isolate root cause', 'Apply minimal fix', 'Validate with tests']
    case 'research':
      return ['Collect sources', 'Compare alternatives', 'Synthesize findings', 'Recommend decision']
    case 'decision':
      return ['Define criteria', 'Score options', 'Rank outcomes', 'Pick recommended path']
    default:
      return ['Understand intent', 'Generate direct response', 'Offer next step']
  }
}

export function executeResponse(mode: CESMode, mergedAgentResponse: string): ExecutionResult {
  const evolution = createResponseEvolution(mergedAgentResponse)
  const buildBlueprint = mode === 'build'
    ? generateBuildBlueprint({ prompt: mergedAgentResponse })
    : undefined

  const summaryByMode: Record<CESMode, string> = {
    build: 'Generated a full-stack project blueprint with file tree, starter code, and deployment path.',
    debug: 'Generated a focused fix path with validation coverage.',
    research: 'Generated a research synthesis with option comparison and recommendation.',
    decision: 'Generated scored options and selected a preferred direction.',
    chat: 'Generated a direct conversational response with CES structure.'
  }

  const final = formatStructuredSections({
    title: `CES ${mode.toUpperCase()} Output`,
    summary: summaryByMode[mode],
    reasoningSteps: buildDefaultPlan(mode),
    blueprint: buildBlueprint,
    finalAnswer: evolution.final
  })

  return {
    draft: evolution.draft,
    refined: evolution.refined,
    final,
    artifacts: {
      mode,
      plan: buildDefaultPlan(mode),
      files: buildBlueprint?.files ?? [],
      tree: buildBlueprint?.tree ?? ['src/', 'src/core/', 'src/agents/', 'src/memory/', 'src/services/']
    }
  }
}
