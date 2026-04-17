/**
 * Extend Express Request with CES middleware properties.
 * Eliminates unsafe `(req as any)` casts throughout the codebase.
 */

import type { Tier, TierConfig } from '../lib/tiers'

declare global {
  namespace Express {
    interface AuthUserContext {
      id: string
      email: string
    }

    interface Request {
      /** Hashed API key identifier for rate-limit bucketing */
      apiKeyId?: string
      /** Resolved tier for this request */
      tier?: Tier
      /** Full tier configuration */
      tierConfig?: TierConfig
      /** Authenticated app user (JWT access token) */
      authUser?: AuthUserContext
      /** Captured raw body for webhook signature verification */
      rawBody?: Buffer
    }
  }
}
