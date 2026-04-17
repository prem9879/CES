export interface ResponseEvolution {
  draft: string
  refined: string
  final: string
}

export function createResponseEvolution(base: string): ResponseEvolution {
  const clean = base.trim()
  const draft = clean.length > 280 ? `${clean.slice(0, 280)}...` : clean
  const refined = clean
  const final = `${clean}\n\nValidated by CES Response Evolution.`

  return { draft, refined, final }
}
