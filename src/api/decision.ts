export interface CesDecisionRequest {
  question: string
  options: string[]
}

export async function runCesDecision(request: CesDecisionRequest): Promise<Response> {
  return fetch('/v1/ces/decision', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request)
  })
}
