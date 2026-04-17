export interface WebSpecCitation {
  title: string
  url: string
  domain: string
  snippet: string
  fetchedAt: number
  kind: 'spec' | 'web'
}
