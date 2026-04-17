export interface CesBuildRequest {
  idea: string
  stack?: string
}

export async function runCesBuild(request: CesBuildRequest): Promise<Response> {
  return fetch('/v1/ces/build', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request)
  })
}
