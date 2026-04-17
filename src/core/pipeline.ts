import { classifyIntent } from './intent-engine'
import { routeMode, type CESMode } from './mode-router'
import { runStrategist } from '@/agents/strategist'
import { runArchitect } from '@/agents/architect'
import { runAnalyst } from '@/agents/analyst'
import { runCritic } from '@/agents/critic'
import { runExecutor } from '@/agents/executor'
import { fuseAgentOutputs } from './fusion-engine'
import { selectBestCandidate } from './decision-engine'
import { executeResponse } from './execution-engine'
import { buildMemoryContext } from '@/memory/runtime-memory'

export interface CESPipelineInput {
  prompt: string
  preferredMode?: CESMode
  memoryContext?: string[]
  pastBuilds?: string[]
}

export interface CESPipelineResult {
  intent: string
  mode: CESMode
  routeReason: string
  steps: string[]
  draft: string
  refined: string
  final: string
  artifacts: {
    mode: CESMode
    plan: string[]
    files: Array<{ path: string; content: string }>
    tree: string[]
  }
}

export async function runCESPipeline(input: CESPipelineInput): Promise<CESPipelineResult> {
  const memoryResult = buildMemoryContext({
    prompt: input.prompt,
    memories: input.memoryContext || [],
    pastBuilds: input.pastBuilds || []
  })

  const effectiveMemories = memoryResult.relevant.length > 0
    ? memoryResult.relevant
    : (input.memoryContext || [])

  const promptWithContext = [
    input.prompt,
    ...(effectiveMemories.length > 0
      ? [`Memory Context: ${effectiveMemories.join(' | ')}`]
      : []),
    ...(input.pastBuilds && input.pastBuilds.length > 0
      ? [`Past Builds: ${input.pastBuilds.join(' | ')}`]
      : [])
  ].join('\n')

  const intentResult = classifyIntent(promptWithContext)
  const routeResult = routeMode(intentResult.intent, input.preferredMode)

  const agentInput = { prompt: promptWithContext, mode: routeResult.mode }
  const [strategist, architect, analyst, critic, executor] = await Promise.all([
    runStrategist(agentInput),
    runArchitect(agentInput),
    runAnalyst(agentInput),
    runCritic(agentInput),
    runExecutor(agentInput)
  ])

  const fused = fuseAgentOutputs([strategist, architect, analyst, critic, executor])
  const decision = selectBestCandidate([
    { id: 'fused', source: 'FusionEngine', content: fused.merged },
    { id: 'executor', source: 'Executor', content: executor.content }
  ], promptWithContext)

  const execution = executeResponse(routeResult.mode, decision.winner.content)

  return {
    intent: intentResult.intent,
    mode: routeResult.mode,
    routeReason: routeResult.reason,
    steps: [
      `IntentEngine: ${intentResult.intent} (${intentResult.confidence.toFixed(2)}) — ${intentResult.rationale}`,
      `ModeRouter: ${routeResult.mode} — ${routeResult.reason}`,
      `MemoryGraph: nodes=${memoryResult.graphNodes}, edges=${memoryResult.graphEdges}, relevant=${effectiveMemories.length}`,
      `Context: memory=${input.memoryContext?.length ?? 0}, past_builds=${input.pastBuilds?.length ?? 0}`,
      'Agents: strategist, architect, analyst, critic, executor',
      `FusionEngine: ${fused.summary}`,
      `FusionConsensus: ${fused.consensus}`,
      `DecisionEngine: winner=${decision.winner.source} (${decision.winner.score.toFixed(2)})`,
      'ExecutionEngine: staged output (Draft -> Refined -> Final)'
    ],
    draft: execution.draft,
    refined: execution.refined,
    final: execution.final,
    artifacts: execution.artifacts
  }
}
