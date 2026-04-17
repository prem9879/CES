export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3)
}

export function inferStack(prompt: string): string[] {
  const lower = prompt.toLowerCase()
  const stack: string[] = []

  if (lower.includes('next.js') || lower.includes('nextjs')) stack.push('Next.js')
  if (lower.includes('react')) stack.push('React')
  if (lower.includes('typescript')) stack.push('TypeScript')
  if (lower.includes('node')) stack.push('Node.js')
  if (lower.includes('express')) stack.push('Express')
  if (lower.includes('postgres') || lower.includes('postgresql')) stack.push('PostgreSQL')
  if (lower.includes('mongodb')) stack.push('MongoDB')
  if (lower.includes('redis')) stack.push('Redis')
  if (lower.includes('docker')) stack.push('Docker')
  if (lower.includes('kubernetes') || lower.includes('aks')) stack.push('Kubernetes')

  return stack.length > 0 ? stack : ['TypeScript', 'Modular services']
}

export function inferDeliverables(mode: string): string[] {
  switch (mode) {
    case 'build':
      return ['project skeleton', 'core modules', 'runbook', 'deployment checklist']
    case 'debug':
      return ['root cause', 'minimal patch', 'regression checks']
    case 'research':
      return ['option matrix', 'tradeoff summary', 'recommended direction']
    case 'decision':
      return ['scored options', 'decision rationale', 'next actions']
    default:
      return ['clear answer', 'actionable next step']
  }
}

export function topKeywords(prompt: string, limit = 6): string[] {
  const stopwords = new Set([
    'the', 'and', 'for', 'with', 'that', 'this', 'from', 'into', 'your', 'you', 'are', 'was', 'will', 'have',
    'has', 'should', 'would', 'could', 'can', 'about', 'make', 'build', 'create', 'please', 'help', 'mode'
  ])

  const counts = new Map<string, number>()
  tokenize(prompt).forEach((token) => {
    if (!stopwords.has(token)) {
      counts.set(token, (counts.get(token) || 0) + 1)
    }
  })

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([keyword]) => keyword)
}

export function confidenceFromSignalCount(signalCount: number, base: number): number {
  return Math.min(0.97, base + signalCount * 0.03)
}
