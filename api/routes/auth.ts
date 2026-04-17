import { Router } from 'express'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import {
  consumeRefreshToken,
  createUser,
  findUserByEmail,
  findUserById,
  publicUser,
  storeRefreshToken,
  verifyPassword,
} from '../lib/user-store'
import { requireUserAuth } from '../middleware/jwtAuth'

const authRoutes = Router()

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production'
const ACCESS_TOKEN_TTL = (process.env.JWT_ACCESS_TTL || '15m') as jwt.SignOptions['expiresIn']
const REFRESH_TOKEN_TTL = (process.env.JWT_REFRESH_TTL || '7d') as jwt.SignOptions['expiresIn']

type AccountPlan = 'free' | 'pro' | 'enterprise'

function normalizePlan(plan: unknown): AccountPlan {
  if (plan === 'pro' || plan === 'enterprise') {
    return plan
  }
  if (plan === 'ultra') {
    return 'enterprise'
  }
  return 'free'
}

function maxRaceTierForPlan(plan: AccountPlan): 'fast' | 'standard' | 'smart' | 'power' | 'ultra' {
  switch (plan) {
    case 'enterprise':
      return 'ultra'
    case 'pro':
      return 'power'
    case 'free':
    default:
      return 'fast'
  }
}

function supportChannelForPlan(plan: AccountPlan): 'community' | 'priority' | 'dedicated' {
  switch (plan) {
    case 'enterprise':
      return 'dedicated'
    case 'pro':
      return 'priority'
    case 'free':
    default:
      return 'community'
  }
}

function issueTokens(userId: string, email: string) {
  const accessToken = jwt.sign({ sub: userId, email, type: 'access' }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_TTL })
  const refreshToken = jwt.sign({ sub: userId, email, type: 'refresh' }, JWT_SECRET, { expiresIn: REFRESH_TOKEN_TTL })

  const decoded = jwt.decode(refreshToken) as { exp?: number } | null
  const expiresAt = decoded?.exp ? decoded.exp * 1000 : Date.now() + 7 * 24 * 60 * 60 * 1000
  storeRefreshToken(refreshToken, userId, expiresAt)

  return { accessToken, refreshToken }
}

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
})

authRoutes.post('/register', (req, res) => {
  const parsed = credentialsSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() })
  }

  try {
    const user = createUser(parsed.data.email, parsed.data.password)
    return res.status(201).json({ user: publicUser(user) })
  } catch (error) {
    if (error instanceof Error && error.message.includes('already')) {
      return res.status(409).json({ error: 'Email already registered' })
    }
    return res.status(500).json({ error: 'Failed to create user account' })
  }
})

authRoutes.post('/login', (req, res) => {
  const parsed = credentialsSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() })
  }

  const email = parsed.data.email.toLowerCase()
  const user = findUserByEmail(email)
  if (!user || !verifyPassword(parsed.data.password, user.passwordSalt, user.passwordHash)) {
    return res.status(401).json({ error: 'Invalid credentials' })
  }

  return res.json({
    user: publicUser(user),
    ...issueTokens(user.id, user.email)
  })
})

authRoutes.post('/refresh', (req, res) => {
  const refreshToken = typeof req.body?.refreshToken === 'string' ? req.body.refreshToken : ''
  if (!refreshToken) {
    return res.status(401).json({ error: 'Invalid refresh token' })
  }

  try {
    const decoded = jwt.verify(refreshToken, JWT_SECRET) as { sub: string; email: string; type: string }
    if (decoded.type !== 'refresh') {
      return res.status(401).json({ error: 'Invalid token type' })
    }

    const consumed = consumeRefreshToken(refreshToken)
    if (!consumed || consumed.userId !== decoded.sub) {
      return res.status(401).json({ error: 'Refresh token expired or already used' })
    }

    const user = findUserById(decoded.sub)
    if (!user) {
      return res.status(401).json({ error: 'User no longer exists' })
    }

    return res.json(issueTokens(user.id, user.email))
  } catch {
    return res.status(401).json({ error: 'Refresh token expired or invalid' })
  }
})

authRoutes.get('/me', requireUserAuth, (req, res) => {
  if (!req.authUser) {
    return res.status(401).json({ error: 'Not authenticated' })
  }

  const user = findUserById(req.authUser.id)
  if (!user) {
    return res.status(404).json({ error: 'User not found' })
  }

  return res.json({ user: publicUser(user) })
})

authRoutes.get('/entitlements', requireUserAuth, (req, res) => {
  if (!req.authUser) {
    return res.status(401).json({ error: 'Not authenticated' })
  }

  const user = findUserById(req.authUser.id)
  if (!user) {
    return res.status(404).json({ error: 'User not found' })
  }

  const plan = normalizePlan(user.subscription.plan)

  return res.json({
    user: publicUser(user),
    entitlements: {
      plan,
      status: user.subscription.status,
      features: {
        ultraplinianEnabled: true,
        consortiumEnabled: plan !== 'free',
        maxRaceTier: maxRaceTierForPlan(plan),
        supportChannel: supportChannelForPlan(plan),
      },
    },
  })
})

authRoutes.post('/oauth/google', (req, res) => {
  const idToken = typeof req.body?.idToken === 'string' ? req.body.idToken : ''
  if (!process.env.GOOGLE_OAUTH_CLIENT_ID) {
    return res.status(400).json({ error: 'Google OAuth is not configured. Set GOOGLE_OAUTH_CLIENT_ID.' })
  }
  if (!idToken) {
    return res.status(400).json({ error: 'idToken is required' })
  }

  return res.status(501).json({
    error: 'Google token verification not yet enabled in this environment.',
    hint: 'Use /v1/auth/register and /v1/auth/login or configure verification service.'
  })
})

export { authRoutes }
