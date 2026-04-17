import { Router } from 'express'
import { buildMemoryContext } from '../../../src/memory/runtime-memory'

export const cesMemoryRoutes = Router()

cesMemoryRoutes.post('/analyze', (req, res) => {
  try {
    const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt : ''
    const memories = Array.isArray(req.body?.memories)
      ? (req.body.memories as unknown[]).filter((value): value is string => typeof value === 'string')
      : []
    const pastBuilds = Array.isArray(req.body?.pastBuilds)
      ? (req.body.pastBuilds as unknown[]).filter((value): value is string => typeof value === 'string')
      : []

    if (!prompt.trim()) {
      return res.status(400).json({ error: 'prompt is required' })
    }

    const context = buildMemoryContext({ prompt, memories, pastBuilds })
    return res.json(context)
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'CES memory analysis failed' })
  }
})
