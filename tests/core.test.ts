import assert from 'node:assert/strict'
import { classifyIntent } from '../src/core/intent-engine'
import { routeMode } from '../src/core/mode-router'
import { selectBestCandidate } from '../src/core/decision-engine'
import { runCESPipeline } from '../src/core/pipeline'

async function run() {
  const intent = classifyIntent('Please debug this stack trace and fix the failing test')
  assert.equal(intent.intent, 'debug')

  const mode = routeMode(intent.intent)
  assert.equal(mode.mode, 'debug')

  const decision = selectBestCandidate(
    [
      { id: 'a', source: 'agent-a', content: 'Short answer.' },
      { id: 'b', source: 'agent-b', content: 'Detailed debug plan with concrete steps and checks.' }
    ],
    'Create a debug plan'
  )
  assert.equal(decision.ranked.length, 2)

  const pipeline = await runCESPipeline({ prompt: 'Build a TypeScript API service' })
  assert.ok(pipeline.steps.length >= 5)
  assert.ok(['build', 'chat', 'research', 'debug', 'decision'].includes(pipeline.mode))

  console.log('CES core tests passed.')
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
