import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production'

interface JwtPayload {
  sub: string
  email: string
  type: 'access' | 'refresh'
  iat?: number
  exp?: number
}

export function requireUserAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing Authorization header (Bearer access token required).' })
    return
  }

  const token = authHeader.slice(7).trim()

  try {
    const payload = jwt.verify(token, JWT_SECRET) as JwtPayload
    if (payload.type !== 'access' || !payload.sub) {
      res.status(401).json({ error: 'Invalid access token.' })
      return
    }

    req.authUser = {
      id: payload.sub,
      email: payload.email,
    }

    next()
  } catch {
    res.status(401).json({ error: 'Access token expired or invalid.' })
  }
}
