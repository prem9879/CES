import { fetchWithAuth, getSession, setSession } from '@/lib/session'

export type AccountPlan = 'free' | 'pro' | 'enterprise'
export type RaceTier = 'fast' | 'standard' | 'smart' | 'power' | 'ultra'

export interface PlanEntitlements {
  plan: AccountPlan
  status: string
  source: 'session' | 'api'
  enforceInApp: boolean
  features: {
    ultraplinianEnabled: boolean
    consortiumEnabled: boolean
    maxRaceTier: RaceTier
    supportChannel: 'community' | 'priority' | 'dedicated'
  }
}

const RACE_TIER_ORDER: Record<RaceTier, number> = {
  fast: 0,
  standard: 1,
  smart: 2,
  power: 3,
  ultra: 4,
}

const CACHE_TTL_MS = 60_000
let entitlementsCache: { value: PlanEntitlements; expiresAt: number } | null = null

function normalizePlan(plan: string | undefined): AccountPlan {
  if (plan === 'pro' || plan === 'enterprise') return plan
  if (plan === 'ultra') return 'enterprise'
  return 'free'
}

function maxRaceTierForPlan(plan: AccountPlan): RaceTier {
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

function fromPlan(planInput: string | undefined, status = 'inactive', source: 'session' | 'api' = 'session'): PlanEntitlements {
  const plan = normalizePlan(planInput)

  return {
    plan,
    status,
    source,
    enforceInApp: Boolean(getSession()),
    features: {
      ultraplinianEnabled: true,
      consortiumEnabled: plan !== 'free',
      maxRaceTier: maxRaceTierForPlan(plan),
      supportChannel: supportChannelForPlan(plan),
    },
  }
}

export function isRaceTierAllowed(selected: RaceTier, maxAllowed: RaceTier): boolean {
  return RACE_TIER_ORDER[selected] <= RACE_TIER_ORDER[maxAllowed]
}

export function getSessionEntitlements(): PlanEntitlements {
  const session = getSession()
  return fromPlan(session?.user?.subscription?.plan, session?.user?.subscription?.status || 'inactive', 'session')
}

export async function loadPlanEntitlements(forceRefresh = false): Promise<PlanEntitlements> {
  if (!forceRefresh && entitlementsCache && entitlementsCache.expiresAt > Date.now()) {
    return entitlementsCache.value
  }

  const current = getSessionEntitlements()
  if (!current.enforceInApp) {
    entitlementsCache = {
      value: current,
      expiresAt: Date.now() + CACHE_TTL_MS,
    }
    return current
  }

  try {
    const response = await fetchWithAuth('/v1/auth/entitlements')
    if (!response.ok) {
      throw new Error('Failed to fetch entitlements')
    }

    const payload = await response.json() as {
      entitlements?: {
        plan?: string
        status?: string
        features?: {
          ultraplinianEnabled?: boolean
          consortiumEnabled?: boolean
          maxRaceTier?: RaceTier
          supportChannel?: 'community' | 'priority' | 'dedicated'
        }
      }
      user?: {
        subscription?: {
          plan?: string
          status?: string
        }
      }
    }

    const plan = normalizePlan(payload.entitlements?.plan || payload.user?.subscription?.plan)
    const next = fromPlan(plan, payload.entitlements?.status || payload.user?.subscription?.status || 'inactive', 'api')

    if (payload.entitlements?.features) {
      next.features = {
        ultraplinianEnabled: payload.entitlements.features.ultraplinianEnabled ?? next.features.ultraplinianEnabled,
        consortiumEnabled: payload.entitlements.features.consortiumEnabled ?? next.features.consortiumEnabled,
        maxRaceTier: payload.entitlements.features.maxRaceTier ?? next.features.maxRaceTier,
        supportChannel: payload.entitlements.features.supportChannel ?? next.features.supportChannel,
      }
    }

    const session = getSession()
    if (session) {
      setSession({
        ...session,
        user: {
          ...session.user,
          subscription: {
            plan,
            status: next.status,
            currentPeriodEnd: session.user.subscription?.currentPeriodEnd,
          },
        },
      })
    }

    entitlementsCache = {
      value: next,
      expiresAt: Date.now() + CACHE_TTL_MS,
    }

    return next
  } catch {
    entitlementsCache = {
      value: current,
      expiresAt: Date.now() + CACHE_TTL_MS,
    }
    return current
  }
}
