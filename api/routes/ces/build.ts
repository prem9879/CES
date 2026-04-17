import { Router } from 'express'
import { runCESPipeline } from '../../../src/core/pipeline'

export const cesBuildRoutes = Router()

cesBuildRoutes.post('/', async (req, res) => {
  try {
    const idea = typeof req.body?.idea === 'string' ? req.body.idea : ''
    const stack = typeof req.body?.stack === 'string' ? req.body.stack : ''
    if (!idea.trim()) {
      return res.status(400).json({ error: 'idea is required' })
    }

    const result = await runCESPipeline({
      prompt: `Build a full-stack application for: ${idea}${stack ? `\nPreferred stack: ${stack}` : ''}`,
      preferredMode: 'build'
    })

    return res.json(result)
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'CES build pipeline failed' })
  }
})
