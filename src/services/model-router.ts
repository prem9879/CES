export type ProviderName = 'openrouter' | 'openai-compatible'

export interface RoutedModelRequest {
  provider: ProviderName
  model: string
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
  apiKey: string
  baseUrl?: string
}

export async function routeModelRequest(req: RoutedModelRequest): Promise<string> {
  const baseUrl = req.baseUrl || 'https://openrouter.ai/api/v1/chat/completions'
  const response = await fetch(baseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${req.apiKey}`
    },
    body: JSON.stringify({ model: req.model, messages: req.messages })
  })

  if (!response.ok) {
    throw new Error(`ModelRouter failed (${response.status})`) 
  }

  const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> }
  return data.choices?.[0]?.message?.content || 'No content returned by provider.'
}
