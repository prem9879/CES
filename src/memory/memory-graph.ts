export interface MemoryNode {
  id: string
  type: 'preference' | 'session' | 'fact'
  value: string
  createdAt: number
}

export class MemoryGraph {
  private nodes = new Map<string, MemoryNode>()
  private edges = new Map<string, Set<string>>()

  upsert(node: MemoryNode): void {
    this.nodes.set(node.id, node)
    if (!this.edges.has(node.id)) {
      this.edges.set(node.id, new Set())
    }
  }

  connect(fromId: string, toId: string): void {
    if (!this.edges.has(fromId)) {
      this.edges.set(fromId, new Set())
    }
    this.edges.get(fromId)?.add(toId)
  }

  getNode(id: string): MemoryNode | undefined {
    return this.nodes.get(id)
  }

  getRelated(id: string): MemoryNode[] {
    const related = this.edges.get(id)
    if (!related) return []
    return [...related].map((nodeId) => this.nodes.get(nodeId)).filter((n): n is MemoryNode => Boolean(n))
  }

  snapshot(): { nodes: MemoryNode[]; edges: Array<{ from: string; to: string }> } {
    const edgeList: Array<{ from: string; to: string }> = []
    this.edges.forEach((targets, from) => {
      targets.forEach((to) => edgeList.push({ from, to }))
    })
    return {
      nodes: [...this.nodes.values()],
      edges: edgeList
    }
  }
}
