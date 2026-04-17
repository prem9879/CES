'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { fetchWithAuth, getSession } from '@/lib/session'

type ReleaseSummary = {
  releaseTag: string
  existingFiles: string[]
  missingFiles: string[]
  status: 'pending' | 'pass' | 'fail'
  updatedAt: number | null
}

type StatusDetail = {
  webhookReplayCompleted: boolean
  payoutDrillCompleted: boolean
  refundDrillCompleted: boolean
  blockingIssues: string
  finalSignoff: string
  status: 'pending' | 'pass' | 'fail'
  updatedAt: number
  updatedBy: string
}

const defaultStatus: Omit<StatusDetail, 'updatedAt' | 'updatedBy'> = {
  webhookReplayCompleted: false,
  payoutDrillCompleted: false,
  refundDrillCompleted: false,
  blockingIssues: '',
  finalSignoff: '',
  status: 'pending',
}

export default function EvidenceAdminPage() {
  const session = useMemo(() => getSession(), [])
  const [releases, setReleases] = useState<ReleaseSummary[]>([])
  const [activeRelease, setActiveRelease] = useState('')
  const [requiredArtifacts, setRequiredArtifacts] = useState<string[]>([])
  const [statusForm, setStatusForm] = useState(defaultStatus)
  const [artifactName, setArtifactName] = useState('webhook-replay.log')
  const [artifactContent, setArtifactContent] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  async function loadReleases() {
    setLoading(true)
    setMessage('')
    try {
      const response = await fetchWithAuth('/v1/ops/stripe-evidence/releases')
      const payload = await response.json() as { error?: string; releases?: ReleaseSummary[]; requiredArtifacts?: string[] }
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to load evidence releases')
      }

      const nextReleases = payload.releases || []
      setRequiredArtifacts(payload.requiredArtifacts || [])
      setReleases(nextReleases)
      if (!activeRelease && nextReleases.length > 0) {
        setActiveRelease(nextReleases[0].releaseTag)
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to load releases')
    } finally {
      setLoading(false)
    }
  }

  async function loadRelease(tag: string) {
    if (!tag) return
    setLoading(true)
    setMessage('')
    try {
      const response = await fetchWithAuth(`/v1/ops/stripe-evidence/${encodeURIComponent(tag)}`)
      const payload = await response.json() as {
        error?: string
        statusDetail?: StatusDetail
        requiredArtifacts?: string[]
      }
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to load release')
      }

      setActiveRelease(tag)
      setRequiredArtifacts(payload.requiredArtifacts || requiredArtifacts)
      if (payload.statusDetail) {
        setStatusForm({
          webhookReplayCompleted: payload.statusDetail.webhookReplayCompleted,
          payoutDrillCompleted: payload.statusDetail.payoutDrillCompleted,
          refundDrillCompleted: payload.statusDetail.refundDrillCompleted,
          blockingIssues: payload.statusDetail.blockingIssues || '',
          finalSignoff: payload.statusDetail.finalSignoff || '',
          status: payload.statusDetail.status,
        })
      } else {
        setStatusForm(defaultStatus)
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to load release data')
    } finally {
      setLoading(false)
    }
  }

  async function saveStatus() {
    if (!activeRelease) {
      setMessage('Set a release tag first.')
      return
    }

    setLoading(true)
    setMessage('')
    try {
      const response = await fetchWithAuth(`/v1/ops/stripe-evidence/${encodeURIComponent(activeRelease)}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(statusForm),
      })
      const payload = await response.json() as { error?: string }
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to save release status')
      }

      setMessage('Release status saved.')
      await loadReleases()
      await loadRelease(activeRelease)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to save status')
    } finally {
      setLoading(false)
    }
  }

  async function uploadArtifact() {
    if (!activeRelease || !artifactName.trim()) {
      setMessage('Set release tag and artifact name first.')
      return
    }

    setLoading(true)
    setMessage('')
    try {
      const response = await fetchWithAuth(`/v1/ops/stripe-evidence/${encodeURIComponent(activeRelease)}/artifact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: artifactName.trim(),
          content: artifactContent,
        }),
      })
      const payload = await response.json() as { error?: string }
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to upload artifact')
      }

      setMessage(`Artifact ${artifactName.trim()} saved for ${activeRelease}.`)
      await loadReleases()
      await loadRelease(activeRelease)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to upload artifact')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadReleases()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!activeRelease) return
    void loadRelease(activeRelease)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRelease])

  const selectedRelease = releases.find((item) => item.releaseTag === activeRelease)

  if (!session) {
    return (
      <main className="legal-shell theme-minimal theme-bg theme-text">
        <section className="legal-card">
          <header className="legal-header">
            <h1>Evidence Admin</h1>
            <p>Sign in with an Enterprise account to manage Stripe production evidence bundles.</p>
            <nav>
              <Link href="/auth">Open Auth</Link>
              <Link href="/support">Support</Link>
            </nav>
          </header>
        </section>
      </main>
    )
  }

  return (
    <main className="legal-shell theme-minimal theme-bg theme-text">
      <section className="legal-card">
        <header className="legal-header">
          <h1>Evidence Admin</h1>
          <p>Upload and track Stripe production evidence per release, with pass or fail status.</p>
          <nav>
            <Link href="/support">Support</Link>
            <Link href="/billing">Billing</Link>
          </nav>
        </header>

        <section className="billing-notes mt-5">
          <h3>Release Selector</h3>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <input
              value={activeRelease}
              onChange={(event) => setActiveRelease(event.target.value.trim())}
              placeholder="release-tag"
              className="min-w-[220px] rounded border border-cyan-400/30 bg-cyan-950/20 px-3 py-2"
            />
            <button type="button" className="rounded border border-cyan-400/40 px-3 py-2" onClick={() => void loadRelease(activeRelease)}>
              Load
            </button>
            <button type="button" className="rounded border border-cyan-400/40 px-3 py-2" onClick={() => void loadReleases()}>
              Refresh
            </button>
          </div>
          <ul className="mt-3">
            {releases.map((release) => (
              <li key={release.releaseTag}>
                <button
                  type="button"
                  className="underline"
                  onClick={() => setActiveRelease(release.releaseTag)}
                >
                  {release.releaseTag} · {release.status.toUpperCase()} · missing {release.missingFiles.length}
                </button>
              </li>
            ))}
            {releases.length === 0 && <li>No release bundles found yet.</li>}
          </ul>
        </section>

        <section className="billing-notes mt-5">
          <h3>Artifact Upload</h3>
          <p>Write artifact content directly into artifacts/stripe-evidence/{activeRelease || '<release-tag>'}/.</p>
          <div className="mt-2 flex flex-wrap gap-2 text-sm">
            <input
              value={artifactName}
              onChange={(event) => setArtifactName(event.target.value)}
              placeholder="artifact file name"
              className="min-w-[260px] rounded border border-cyan-400/30 bg-cyan-950/20 px-3 py-2"
            />
            <button type="button" className="rounded border border-cyan-400/40 px-3 py-2" onClick={() => void uploadArtifact()}>
              Save artifact
            </button>
          </div>
          <textarea
            value={artifactContent}
            onChange={(event) => setArtifactContent(event.target.value)}
            rows={8}
            placeholder="Paste artifact content here"
            className="mt-2 w-full rounded border border-cyan-400/30 bg-cyan-950/20 p-3 text-sm"
          />
          <p className="mt-2 text-xs opacity-80">Expected artifacts: {requiredArtifacts.join(', ') || 'none loaded yet'}.</p>
        </section>

        <section className="billing-notes mt-5">
          <h3>Release Gate Status</h3>
          <div className="grid gap-2 text-sm">
            <label>
              <input
                type="checkbox"
                checked={statusForm.webhookReplayCompleted}
                onChange={(event) => setStatusForm((prev) => ({ ...prev, webhookReplayCompleted: event.target.checked }))}
              />{' '}
              Webhook replay completed
            </label>
            <label>
              <input
                type="checkbox"
                checked={statusForm.payoutDrillCompleted}
                onChange={(event) => setStatusForm((prev) => ({ ...prev, payoutDrillCompleted: event.target.checked }))}
              />{' '}
              Payout drill completed
            </label>
            <label>
              <input
                type="checkbox"
                checked={statusForm.refundDrillCompleted}
                onChange={(event) => setStatusForm((prev) => ({ ...prev, refundDrillCompleted: event.target.checked }))}
              />{' '}
              Refund drill completed
            </label>
          </div>

          <div className="mt-3">
            <label className="text-sm">Overall status</label>
            <select
              value={statusForm.status}
              onChange={(event) => setStatusForm((prev) => ({ ...prev, status: event.target.value as 'pending' | 'pass' | 'fail' }))}
              className="ml-2 rounded border border-cyan-400/30 bg-cyan-950/20 px-2 py-1"
            >
              <option value="pending">pending</option>
              <option value="pass">pass</option>
              <option value="fail">fail</option>
            </select>
          </div>

          <textarea
            value={statusForm.blockingIssues}
            onChange={(event) => setStatusForm((prev) => ({ ...prev, blockingIssues: event.target.value }))}
            rows={3}
            placeholder="Blocking issues"
            className="mt-2 w-full rounded border border-cyan-400/30 bg-cyan-950/20 p-3 text-sm"
          />

          <textarea
            value={statusForm.finalSignoff}
            onChange={(event) => setStatusForm((prev) => ({ ...prev, finalSignoff: event.target.value }))}
            rows={3}
            placeholder="Final signoff summary"
            className="mt-2 w-full rounded border border-cyan-400/30 bg-cyan-950/20 p-3 text-sm"
          />

          <button type="button" className="mt-2 rounded border border-cyan-400/40 px-3 py-2 text-sm" onClick={() => void saveStatus()}>
            Save gate status
          </button>

          {selectedRelease && (
            <p className="mt-2 text-xs opacity-80">
              Current release: {selectedRelease.releaseTag}. Existing files: {selectedRelease.existingFiles.length}. Missing files: {selectedRelease.missingFiles.length}.
            </p>
          )}
        </section>

        <section className="billing-notes mt-5">
          <h3>System Message</h3>
          <p>{loading ? 'Working...' : message || 'Ready.'}</p>
        </section>
      </section>
    </main>
  )
}
