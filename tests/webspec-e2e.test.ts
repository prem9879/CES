import assert from 'node:assert/strict'
import { buildCitationContextBlock, fetchTrustedSourceCitations, normalizeTrustedSourceUrl, suggestTrustedSources } from '../src/lib/webspec'

async function run() {
  assert.ok(normalizeTrustedSourceUrl('https://developer.apple.com/documentation/')?.hostname.includes('apple.com'))
  assert.equal(normalizeTrustedSourceUrl('https://example.com/spec'), null)

  const hints = suggestTrustedSources('Compare the iPhone and Galaxy specs')
  assert.ok(hints.some((source) => source.includes('apple.com')))
  assert.ok(hints.some((source) => source.includes('samsung.com')))

  const originalFetch = global.fetch
  global.fetch = (async (input: string | URL | Request) => {
    const url = input.toString()
    if (url.includes('apple.com')) {
      return new Response('<html><head><title>Apple iPhone</title></head><body><main>Official iPhone battery and camera specifications.</main></body></html>', {
        status: 200,
        headers: { 'content-type': 'text/html' },
      })
    }

    return new Response('<html><head><title>Samsung Galaxy</title></head><body><main>Official Galaxy Ultra launch and spec details.</main></body></html>', {
      status: 200,
      headers: { 'content-type': 'text/html' },
    })
  }) as typeof fetch

  try {
    const result = await fetchTrustedSourceCitations({
      query: 'Compare iPhone and Galaxy specs',
      sources: [
        'https://www.apple.com/iphone/',
        'https://www.samsung.com/global/galaxy/',
      ],
    })

    assert.equal(result.citations.length, 2)
    assert.ok(result.context.includes('[TRUSTED_SOURCES]'))
    assert.ok(result.context.includes('Apple iPhone'))
    assert.ok(result.context.includes('Samsung Galaxy'))

    const block = buildCitationContextBlock('Compare iPhone and Galaxy specs', result.citations)
    assert.ok(block.includes('Use the numbered citations inline'))
  } finally {
    global.fetch = originalFetch
  }

  console.log('Web/spec e2e test passed.')
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
