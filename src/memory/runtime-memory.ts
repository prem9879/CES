import { MemoryGraph, type MemoryNode } from './memory-graph'

interface BuildMemoryContextInput {
  prompt: string
  memories: string[]
  pastBuilds?: string[]
}

interface BuildMemoryContextResult {
  relevant: string[]
  graphNodes: number
  graphEdges: number
}

function normalizeTokens(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .map((t) => t.trim())
      .filter((t) => t.length >= 3)
  )
}

function overlapSize(a: Set<string>, b: Set<string>): number {
  let count = 0
  a.forEach((token) => {
    if (b.has(token)) count += 1
  })
  return count
}

function inferNodeType(value: string): MemoryNode['type'] {
  const lower = value.toLowerCase()
  if (lower.includes('prefer') || lower.includes('style') || lower.includes('always')) {
    return 'preference'
  }
  return 'fact'
}

export function buildMemoryContext(input: BuildMemoryContextInput): BuildMemoryContextResult {
  const graph = new MemoryGraph()
  const now = Date.now()
  const promptNodeId = 'prompt-current'
  const memoryNodeIds: string[] = []

  input.memories.forEach((value, idx) => {
    const id = `memory-${idx + 1}`
    memoryNodeIds.push(id)
    graph.upsert({
      id,
      type: inferNodeType(value),
      value,
      createdAt: now + idx
    })
  })

  ;(input.pastBuilds || []).forEach((value, idx) => {
    const id = `build-${idx + 1}`
    memoryNodeIds.push(id)
    graph.upsert({
      id,
      type: 'session',
      value,
      createdAt: now + input.memories.length + idx
    })
  })

  graph.upsert({
    id: promptNodeId,
    type: 'session',
    value: input.prompt,
    createdAt: now + 9999
  })

  const promptTokens = normalizeTokens(input.prompt)
  const nodeTokens = new Map<string, Set<string>>()

  memoryNodeIds.forEach((id) => {
    const node = graph.getNode(id)
    if (node) {
      nodeTokens.set(id, normalizeTokens(node.value))
    }
  })

  memoryNodeIds.forEach((id) => {
    const tokens = nodeTokens.get(id)
    if (!tokens) return

    if (overlapSize(promptTokens, tokens) > 0) {
      graph.connect(promptNodeId, id)
    }

    memoryNodeIds.forEach((otherId) => {
      if (id === otherId) return
      const otherTokens = nodeTokens.get(otherId)
      if (!otherTokens) return
      if (overlapSize(tokens, otherTokens) >= 2) {
        graph.connect(id, otherId)
      }
    })
  })

  const related = graph.getRelated(promptNodeId)
  const ranked = related
    .map((node) => ({
      node,
      score: overlapSize(promptTokens, normalizeTokens(node.value))
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map((entry) => entry.node.value)

  const snapshot = graph.snapshot()
  return {
    relevant: ranked,
    graphNodes: snapshot.nodes.length,
    graphEdges: snapshot.edges.length
  }
}
