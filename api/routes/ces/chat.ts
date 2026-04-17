import { Router } from 'express'
import { runCESPipeline } from '../../../src/core/pipeline'

export const cesChatRoutes = Router()

cesChatRoutes.post('/', async (req, res) => {
  try {
    const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt : ''
    const mode = typeof req.body?.mode === 'string' ? req.body.mode : undefined
    const memoryContext = Array.isArray(req.body?.memoryContext)
      ? (req.body.memoryContext as unknown[]).filter((value): value is string => typeof value === 'string')
      : []
    const pastBuilds = Array.isArray(req.body?.pastBuilds)
      ? (req.body.pastBuilds as unknown[]).filter((value): value is string => typeof value === 'string')
      : []

    if (!prompt.trim()) {
      return res.status(400).json({ error: 'prompt is required' })
    }

    const result = await runCESPipeline({
      prompt,
      preferredMode: mode as never,
      memoryContext,
      pastBuilds
    })
    return res.json(result)
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'CES chat pipeline failed' })
  }
})
