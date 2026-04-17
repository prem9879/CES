import type { Request } from 'express'
import jwt from 'jsonwebtoken'
import { findUserById } from './user-store'

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production'

export type AccountPlan = 'free' | 'pro' | 'enterprise'
export type RaceTier = 'fast' | 'standard' | 'smart' | 'power' | 'ultra'

interface JwtPayload {
  sub: string
  email: string
  type: 'access' | 'refresh'
}

const RACE_TIER_ORDER: Record<RaceTier, number> = {
  fast: 0,
  standard: 1,
  smart: 2,
  power: 3,
  ultra: 4,
}

export interface AuthenticatedEntitlementContext {
  userId: string
  email: string
  plan: AccountPlan
  status: string
  maxRaceTier: RaceTier
  consortiumEnabled: boolean
}

export function normalizeAccountPlan(plan: unknown): AccountPlan {
  if (plan === 'pro' || plan === 'enterprise') return plan
  if (plan === 'ultra') return 'enterprise'
  return 'free'
}

export function maxRaceTierForPlan(plan: AccountPlan): RaceTier {
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

export function isRaceTierAllowedForPlan(selected: RaceTier, plan: AccountPlan): boolean {
  return RACE_TIER_ORDER[selected] <= RACE_TIER_ORDER[maxRaceTierForPlan(plan)]
}

function extractUserAccessToken(req: Request): string | null {
  const raw = req.headers['x-user-access-token']
  if (!raw) return null
  if (Array.isArray(raw)) return raw[0]?.trim() || null
  return String(raw).trim() || null
}

export function resolveOptionalAuthenticatedEntitlements(req: Request): AuthenticatedEntitlementContext | null {
  const accessToken = extractUserAccessToken(req)
  if (!accessToken) return null

  const payload = jwt.verify(accessToken, JWT_SECRET) as JwtPayload
  if (payload.type !== 'access' || !payload.sub) {
    throw new Error('Invalid user access token type.')
  }

  const user = findUserById(payload.sub)
  if (!user) {
    throw new Error('Authenticated user not found.')
  }

  const plan = normalizeAccountPlan(user.subscription.plan)

  return {
    userId: user.id,
    email: user.email,
    plan,
    status: user.subscription.status,
    maxRaceTier: maxRaceTierForPlan(plan),
    consortiumEnabled: plan !== 'free',
  }
}
