'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { ONBOARDING_PROMPT_PACKS, type OnboardingRole } from '@/lib/onboarding-prompt-packs'

const STORAGE_KEY = 'ces.onboarding.completed.v1'

const steps = [
  {
    title: 'Welcome to CES',
    body: 'This workspace combines chat, tools, and live reasoning in one shell so you can move from idea to execution faster.',
  },
  {
    title: 'Set Up Your Workflow',
    body: 'Start in Settings to choose your API mode and theme. Then run a short command in chat to validate your setup.',
  },
  {
    title: 'Unlock Paid Features',
    body: 'Open Billing to compare Pro vs Enterprise, upgrade instantly, and manage your subscription in Stripe portal.',
  },
]

export function FirstRunOnboarding() {
  const [visible, setVisible] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const [selectedRole, setSelectedRole] = useState<OnboardingRole>('engineer')
  const [copiedPrompt, setCopiedPrompt] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const completed = window.localStorage.getItem(STORAGE_KEY)
    if (!completed) {
      setVisible(true)
    }
  }, [])

  const step = useMemo(() => steps[stepIndex], [stepIndex])
  const selectedPack = useMemo(
    () => ONBOARDING_PROMPT_PACKS.find((pack) => pack.id === selectedRole) || ONBOARDING_PROMPT_PACKS[0],
    [selectedRole],
  )
  const isLastStep = stepIndex === steps.length - 1

  async function copyPrompt(prompt: string) {
    try {
      await navigator.clipboard.writeText(prompt)
      setCopiedPrompt(prompt)
      window.setTimeout(() => setCopiedPrompt(null), 1500)
    } catch {
      setCopiedPrompt(null)
    }
  }

  function closeOnboarding(markCompleted: boolean) {
    if (markCompleted && typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, 'true')
    }
    setVisible(false)
  }

  if (!visible) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-2xl rounded-xl border border-cyan-400/30 bg-[#07111a] p-6 text-cyan-100 shadow-[0_20px_80px_rgba(0,0,0,0.55)]">
        <div className="mb-5 flex items-center justify-between">
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-300/80">First-run onboarding</p>
          <button
            type="button"
            className="rounded border border-cyan-400/30 px-3 py-1 text-xs text-cyan-200 hover:bg-cyan-500/10"
            onClick={() => closeOnboarding(true)}
          >
            Skip
          </button>
        </div>

        <h2 className="text-2xl font-semibold text-cyan-100">{step.title}</h2>
        <p className="mt-3 text-sm leading-relaxed text-cyan-100/85">{step.body}</p>

        <div className="mt-6 grid gap-3 rounded-lg border border-cyan-400/20 bg-cyan-950/20 p-4 text-sm">
          <p className="font-medium text-cyan-200">Quick actions</p>
          <div className="flex flex-wrap gap-2">
            <Link href="/auth" className="rounded border border-cyan-400/35 px-3 py-1.5 hover:bg-cyan-500/10">
              Open Auth
            </Link>
            <Link href="/billing" className="rounded border border-cyan-400/35 px-3 py-1.5 hover:bg-cyan-500/10">
              Open Billing
            </Link>
            <Link href="/enterprise" className="rounded border border-cyan-400/35 px-3 py-1.5 hover:bg-cyan-500/10">
              Enterprise Package
            </Link>
            <Link href="/support" className="rounded border border-cyan-400/35 px-3 py-1.5 hover:bg-cyan-500/10">
              Support & Status
            </Link>
          </div>
        </div>

        <div className="mt-4 grid gap-3 rounded-lg border border-cyan-400/20 bg-cyan-950/20 p-4 text-sm">
          <p className="font-medium text-cyan-200">Demo Prompt Pack</p>
          <p className="text-xs text-cyan-100/75">Choose your role and paste starter flows directly into chat.</p>

          <div className="flex flex-wrap gap-2">
            {ONBOARDING_PROMPT_PACKS.map((pack) => (
              <button
                key={pack.id}
                type="button"
                className={`rounded border px-2.5 py-1 text-xs ${
                  selectedRole === pack.id
                    ? 'border-cyan-300 bg-cyan-400/20 text-cyan-100'
                    : 'border-cyan-600/60 text-cyan-200/85 hover:bg-cyan-400/10'
                }`}
                onClick={() => setSelectedRole(pack.id)}
              >
                {pack.label}
              </button>
            ))}
          </div>

          <p className="text-xs text-cyan-100/70">{selectedPack.description}</p>
          <div className="grid gap-2">
            {selectedPack.prompts.map((prompt) => (
              <button
                key={prompt}
                type="button"
                className="rounded border border-cyan-700/60 px-3 py-2 text-left text-xs hover:bg-cyan-400/10"
                onClick={() => {
                  void copyPrompt(prompt)
                }}
              >
                <span className="block text-cyan-100/90">{prompt}</span>
                <span className="mt-1 block text-[10px] text-cyan-300/70">
                  {copiedPrompt === prompt ? 'Copied to clipboard' : 'Click to copy'}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between gap-3">
          <p className="text-xs text-cyan-300/75">Step {stepIndex + 1} of {steps.length}</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded border border-cyan-400/30 px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-40"
              onClick={() => setStepIndex((current) => Math.max(0, current - 1))}
              disabled={stepIndex === 0}
            >
              Back
            </button>
            {isLastStep ? (
              <button
                type="button"
                className="rounded bg-cyan-400 px-3 py-1.5 text-sm font-semibold text-slate-900 hover:bg-cyan-300"
                onClick={() => closeOnboarding(true)}
              >
                Finish setup
              </button>
            ) : (
              <button
                type="button"
                className="rounded bg-cyan-400 px-3 py-1.5 text-sm font-semibold text-slate-900 hover:bg-cyan-300"
                onClick={() => setStepIndex((current) => Math.min(steps.length - 1, current + 1))}
              >
                Continue
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}