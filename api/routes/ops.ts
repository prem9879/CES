import fs from 'fs'
import path from 'path'
import { Router } from 'express'
import type { Request, Response } from 'express'
import { z } from 'zod'
import { requireUserAuth } from '../middleware/jwtAuth'
import { findUserById } from '../lib/user-store'
import { normalizeAccountPlan } from '../lib/user-entitlements'

const opsRoutes = Router()

const EVIDENCE_ROOT = path.join(process.cwd(), 'artifacts', 'stripe-evidence')
const STATUS_FILE = '.status.json'
const REQUIRED_ARTIFACTS = [
  'webhook-replay.log',
  'subscription-sync.json',
  'payout-drill.log',
  'refund-drill.log',
  'operator-signoff.md',
]

const statusSchema = z.object({
  webhookReplayCompleted: z.boolean(),
  payoutDrillCompleted: z.boolean(),
  refundDrillCompleted: z.boolean(),
  blockingIssues: z.string().max(2000).optional().default(''),
  finalSignoff: z.string().max(1000).optional().default(''),
  status: z.enum(['pending', 'pass', 'fail']).default('pending'),
})

const artifactSchema = z.object({
  name: z.string().min(3).max(120),
  content: z.string().max(500_000),
})

interface EvidenceStatus {
  webhookReplayCompleted: boolean
  payoutDrillCompleted: boolean
  refundDrillCompleted: boolean
  blockingIssues: string
  finalSignoff: string
  status: 'pending' | 'pass' | 'fail'
  updatedAt: number
  updatedBy: string
}

function ensureRoot(): void {
  if (!fs.existsSync(EVIDENCE_ROOT)) {
    fs.mkdirSync(EVIDENCE_ROOT, { recursive: true })
  }
}

function sanitizeReleaseTag(tag: string): string | null {
  if (!/^[A-Za-z0-9._-]+$/.test(tag)) return null
  return tag
}

function releaseDir(tag: string): string {
  return path.join(EVIDENCE_ROOT, tag)
}

function readStatus(tag: string): EvidenceStatus | null {
  const file = path.join(releaseDir(tag), STATUS_FILE)
  if (!fs.existsSync(file)) return null

  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as EvidenceStatus
  } catch {
    return null
  }
}

function writeStatus(tag: string, status: EvidenceStatus): void {
  const dir = releaseDir(tag)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  fs.writeFileSync(path.join(dir, STATUS_FILE), JSON.stringify(status, null, 2), 'utf8')
}

function summarizeRelease(tag: string): {
  releaseTag: string
  existingFiles: string[]
  missingFiles: string[]
  status: 'pending' | 'pass' | 'fail'
  updatedAt: number | null
} {
  const dir = releaseDir(tag)
  const files = fs.existsSync(dir)
    ? fs.readdirSync(dir).filter((name) => name !== STATUS_FILE)
    : []
  const existingSet = new Set(files)
  const missing = REQUIRED_ARTIFACTS.filter((name) => !existingSet.has(name))
  const status = readStatus(tag)

  return {
    releaseTag: tag,
    existingFiles: files.sort(),
    missingFiles: missing,
    status: status?.status || (missing.length === 0 ? 'pass' : 'pending'),
    updatedAt: status?.updatedAt || null,
  }
}

function ensureEnterpriseAccess(req: Request, res: Response): boolean {
  if (!req.authUser) {
    res.status(401).json({ error: 'Not authenticated' })
    return false
  }

  const user = findUserById(req.authUser.id)
  if (!user) {
    res.status(404).json({ error: 'User not found' })
    return false
  }

  const plan = normalizeAccountPlan(user.subscription.plan)
  if (plan !== 'enterprise') {
    res.status(403).json({ error: 'Enterprise plan required for ops evidence administration.' })
    return false
  }

  return true
}

opsRoutes.get('/stripe-evidence/releases', requireUserAuth, (req, res) => {
  if (!ensureEnterpriseAccess(req, res)) return
  ensureRoot()

  const tags = fs
    .readdirSync(EVIDENCE_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => b.localeCompare(a))

  const releases = tags.map((tag) => summarizeRelease(tag))

  res.json({
    requiredArtifacts: REQUIRED_ARTIFACTS,
    releases,
  })
})

opsRoutes.get('/stripe-evidence/:releaseTag', requireUserAuth, (req, res) => {
  if (!ensureEnterpriseAccess(req, res)) return

  const safeTag = sanitizeReleaseTag(String(req.params.releaseTag || ''))
  if (!safeTag) {
    res.status(400).json({ error: 'Invalid release tag format.' })
    return
  }

  ensureRoot()
  const summary = summarizeRelease(safeTag)
  const status = readStatus(safeTag)

  res.json({
    ...summary,
    requiredArtifacts: REQUIRED_ARTIFACTS,
    statusDetail: status,
  })
})

opsRoutes.put('/stripe-evidence/:releaseTag/status', requireUserAuth, (req, res) => {
  if (!ensureEnterpriseAccess(req, res)) return

  const safeTag = sanitizeReleaseTag(String(req.params.releaseTag || ''))
  if (!safeTag) {
    res.status(400).json({ error: 'Invalid release tag format.' })
    return
  }

  const parsed = statusSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() })
    return
  }

  const status: EvidenceStatus = {
    ...parsed.data,
    updatedAt: Date.now(),
    updatedBy: req.authUser?.email || 'unknown',
  }

  ensureRoot()
  writeStatus(safeTag, status)

  res.json({
    ok: true,
    release: summarizeRelease(safeTag),
    statusDetail: status,
  })
})

opsRoutes.post('/stripe-evidence/:releaseTag/artifact', requireUserAuth, (req, res) => {
  if (!ensureEnterpriseAccess(req, res)) return

  const safeTag = sanitizeReleaseTag(String(req.params.releaseTag || ''))
  if (!safeTag) {
    res.status(400).json({ error: 'Invalid release tag format.' })
    return
  }

  const parsed = artifactSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() })
    return
  }

  const safeFileName = path.basename(parsed.data.name)
  if (!/^[A-Za-z0-9._-]+$/.test(safeFileName) || safeFileName === STATUS_FILE) {
    res.status(400).json({ error: 'Invalid artifact file name.' })
    return
  }

  ensureRoot()
  const dir = releaseDir(safeTag)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  const target = path.join(dir, safeFileName)
  fs.writeFileSync(target, parsed.data.content, 'utf8')

  res.json({
    ok: true,
    release: summarizeRelease(safeTag),
  })
})

export { opsRoutes }
