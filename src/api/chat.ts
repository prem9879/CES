import type { CESMode } from '@/core/mode-router'

export interface CesChatRequest {
  prompt: string
  mode: CESMode
}

export async function runCesChat(request: CesChatRequest): Promise<Response> {
  return fetch('/v1/ces/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request)
  })
}
