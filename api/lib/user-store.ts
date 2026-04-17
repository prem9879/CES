import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

export type SubscriptionPlan = 'free' | 'pro' | 'enterprise'
export type SubscriptionStatus = 'inactive' | 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid'

export interface StoredSubscription {
  plan: SubscriptionPlan
  status: SubscriptionStatus
  stripeCustomerId?: string
  stripeSubscriptionId?: string
  currentPeriodEnd?: number
  updatedAt: number
}

export interface StoredUser {
  id: string
  email: string
  passwordSalt: string
  passwordHash: string
  createdAt: number
  updatedAt: number
  subscription: StoredSubscription
}

interface RefreshSession {
  tokenHash: string
  userId: string
  expiresAt: number
  createdAt: number
}

interface UserStoreData {
  users: StoredUser[]
  refreshSessions: RefreshSession[]
}

const STORE_DIR = path.join(process.cwd(), 'api', 'data')
const STORE_FILE = path.join(STORE_DIR, 'users.json')

function defaultSubscription(): StoredSubscription {
  return {
    plan: 'free',
    status: 'inactive',
    updatedAt: Date.now(),
  }
}

function normalizeSubscriptionPlan(plan: unknown): SubscriptionPlan {
  if (plan === 'free' || plan === 'pro' || plan === 'enterprise') {
    return plan
  }

  if (plan === 'ultra') {
    return 'enterprise'
  }

  return 'free'
}

function ensureStore(): void {
  if (!fs.existsSync(STORE_DIR)) {
    fs.mkdirSync(STORE_DIR, { recursive: true })
  }
  if (!fs.existsSync(STORE_FILE)) {
    const initial: UserStoreData = { users: [], refreshSessions: [] }
    fs.writeFileSync(STORE_FILE, JSON.stringify(initial, null, 2), 'utf8')
  }
}

function readStore(): UserStoreData {
  ensureStore()
  try {
    const parsed = JSON.parse(fs.readFileSync(STORE_FILE, 'utf8')) as Partial<UserStoreData>
    const users = Array.isArray(parsed.users)
      ? parsed.users.map((user) => ({
          ...user,
          subscription: user.subscription
            ? {
                ...user.subscription,
                plan: normalizeSubscriptionPlan(user.subscription.plan),
              }
            : defaultSubscription(),
        }))
      : []
    return {
      users,
      refreshSessions: Array.isArray(parsed.refreshSessions) ? parsed.refreshSessions : [],
    }
  } catch {
    const fallback: UserStoreData = { users: [], refreshSessions: [] }
    fs.writeFileSync(STORE_FILE, JSON.stringify(fallback, null, 2), 'utf8')
    return fallback
  }
}

function writeStore(data: UserStoreData): void {
  ensureStore()
  fs.writeFileSync(STORE_FILE, JSON.stringify(data, null, 2), 'utf8')
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export function hashPassword(password: string, salt = crypto.randomBytes(16).toString('hex')): { salt: string; hash: string } {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex')
  return { salt, hash }
}

export function verifyPassword(password: string, salt: string, hash: string): boolean {
  const computed = crypto.scryptSync(password, salt, 64)
  const expected = Buffer.from(hash, 'hex')
  if (computed.length !== expected.length) return false
  return crypto.timingSafeEqual(computed, expected)
}

export function createUser(email: string, password: string): StoredUser {
  const store = readStore()
  const normalizedEmail = email.toLowerCase()
  if (store.users.some((u) => u.email === normalizedEmail)) {
    throw new Error('Email already registered')
  }

  const now = Date.now()
  const { salt, hash } = hashPassword(password)
  const user: StoredUser = {
    id: crypto.randomUUID(),
    email: normalizedEmail,
    passwordSalt: salt,
    passwordHash: hash,
    createdAt: now,
    updatedAt: now,
    subscription: defaultSubscription(),
  }

  store.users.push(user)
  writeStore(store)
  return user
}

export function findUserByEmail(email: string): StoredUser | undefined {
  const store = readStore()
  return store.users.find((u) => u.email === email.toLowerCase())
}

export function findUserById(userId: string): StoredUser | undefined {
  const store = readStore()
  return store.users.find((u) => u.id === userId)
}

export function findUserByStripeCustomerId(customerId: string): StoredUser | undefined {
  const store = readStore()
  return store.users.find((u) => u.subscription.stripeCustomerId === customerId)
}

export function findUserByStripeSubscriptionId(subscriptionId: string): StoredUser | undefined {
  const store = readStore()
  return store.users.find((u) => u.subscription.stripeSubscriptionId === subscriptionId)
}

export function storeRefreshToken(token: string, userId: string, expiresAt: number): void {
  const store = readStore()
  const now = Date.now()
  const tokenHash = hashToken(token)
  store.refreshSessions = store.refreshSessions.filter((s) => s.expiresAt > now && s.userId !== userId)
  store.refreshSessions.push({ tokenHash, userId, expiresAt, createdAt: now })
  writeStore(store)
}

export function consumeRefreshToken(token: string): { userId: string } | null {
  const store = readStore()
  const now = Date.now()
  const tokenHash = hashToken(token)
  const hit = store.refreshSessions.find((s) => s.tokenHash === tokenHash && s.expiresAt > now)
  if (!hit) return null
  store.refreshSessions = store.refreshSessions.filter((s) => s.tokenHash !== tokenHash)
  writeStore(store)
  return { userId: hit.userId }
}

export function updateUserSubscription(
  userId: string,
  patch: Partial<StoredSubscription> & Pick<StoredSubscription, 'plan' | 'status'>,
): StoredUser | null {
  const store = readStore()
  const index = store.users.findIndex((u) => u.id === userId)
  if (index === -1) return null

  const prev = store.users[index]
  const next: StoredUser = {
    ...prev,
    updatedAt: Date.now(),
    subscription: {
      ...prev.subscription,
      ...patch,
      updatedAt: Date.now(),
    },
  }

  store.users[index] = next
  writeStore(store)
  return next
}

export function publicUser(user: StoredUser): { id: string; email: string; subscription: StoredSubscription } {
  return {
    id: user.id,
    email: user.email,
    subscription: user.subscription,
  }
}
