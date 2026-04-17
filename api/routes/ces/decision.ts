import { Router } from 'express'
import { selectBestCandidate } from '../../../src/core/decision-engine'

export const cesDecisionRoutes = Router()

cesDecisionRoutes.post('/', (req, res) => {
  try {
    const question = typeof req.body?.question === 'string' ? req.body.question : ''
    const options = Array.isArray(req.body?.options)
      ? (req.body.options as unknown[]).filter((v: unknown): v is string => typeof v === 'string')
      : []

    if (!question.trim() || options.length < 2) {
      return res.status(400).json({ error: 'question and at least 2 options are required' })
    }

    const decision = selectBestCandidate(
      options.map((option, idx) => ({ id: `option-${idx + 1}`, source: `option-${idx + 1}`, content: option })),
      question
    )

    return res.json(decision)
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'CES decision failed' })
  }
})
