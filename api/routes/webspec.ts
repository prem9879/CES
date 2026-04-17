import { Router } from 'express'
import { buildCitationContextBlock, fetchTrustedSourceCitations } from '../../src/lib/webspec'

export const webSpecRoutes = Router()

webSpecRoutes.post('/web-spec', async (req, res) => {
  try {
    const query = typeof req.body?.query === 'string' ? req.body.query.trim() : ''
    const requestedSources = Array.isArray(req.body?.sources) ? (req.body.sources as unknown[]) : undefined
    const sources = requestedSources
      ? requestedSources.filter((source): source is string => typeof source === 'string')
      : undefined

    if (!query) {
      res.status(400).json({ error: 'query is required.' })
      return
    }

    const result = await fetchTrustedSourceCitations({
      query,
      sources,
    })

    res.json({
      query,
      citations: result.citations,
      sources_used: result.sourcesUsed,
      context: buildCitationContextBlock(query, result.citations),
      summary: result.citations.length > 0
        ? `Fetched ${result.citations.length} trusted source${result.citations.length === 1 ? '' : 's'}.`
        : 'No trusted sources matched this query.',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Web/spec lookup failed.'
    res.status(500).json({ error: message })
  }
})
