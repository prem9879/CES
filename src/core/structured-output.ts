import type { BuildBlueprint } from './build-generator'

export interface StructuredSectionsInput {
  title: string
  summary: string
  reasoningSteps: string[]
  blueprint?: BuildBlueprint
  finalAnswer: string
}

export function formatStructuredSections(input: StructuredSectionsInput): string {
  const lines: string[] = []

  lines.push(`# ${input.title}`)
  lines.push('')
  lines.push('## Summary')
  lines.push(input.summary)
  lines.push('')

  lines.push('## Reasoning Steps')
  if (input.reasoningSteps.length === 0) {
    lines.push('- No explicit reasoning steps recorded.')
  } else {
    input.reasoningSteps.forEach((step) => lines.push(`- ${step}`))
  }
  lines.push('')

  if (input.blueprint) {
    lines.push('## Structure')
    input.blueprint.tree.forEach((entry) => lines.push(`- ${entry}`))
    lines.push('')

    lines.push('## Code')
    input.blueprint.files.forEach((file) => {
      lines.push(`### ${file.path}`)
      lines.push('```ts')
      lines.push(file.content.trim())
      lines.push('```')
      lines.push('')
    })

    lines.push('## Steps')
    input.blueprint.deploymentSteps.forEach((step, idx) => lines.push(`${idx + 1}. ${step}`))
    lines.push('')
  }

  lines.push('## Final')
  lines.push(input.finalAnswer)

  return lines.join('\n')
}
