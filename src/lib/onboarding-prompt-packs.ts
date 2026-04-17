export type OnboardingRole = 'founder' | 'product' | 'engineer' | 'ops'

export interface PromptPack {
  id: OnboardingRole
  label: string
  description: string
  prompts: string[]
}

export const ONBOARDING_PROMPT_PACKS: PromptPack[] = [
  {
    id: 'founder',
    label: 'Founder / CEO',
    description: 'Fast clarity on strategy, positioning, and go-to-market decisions.',
    prompts: [
      '/research Build a 30-day launch plan for my product with weekly milestones and risks.',
      'Draft a one-page positioning memo that explains why we win and where we are weak.',
      'Create an investor update template with KPI highlights, blockers, and asks.',
    ],
  },
  {
    id: 'product',
    label: 'Product Manager',
    description: 'Roadmaps, prioritization, and specification acceleration.',
    prompts: [
      '/research Compare three roadmap options for Q next quarter with tradeoffs and recommendation.',
      'Turn this feature idea into a PRD with acceptance criteria and rollout phases.',
      'Generate a user interview script to validate problem-solution fit in 20 minutes.',
    ],
  },
  {
    id: 'engineer',
    label: 'Engineer / Builder',
    description: 'Ship-ready implementation plans and debugging workflows.',
    prompts: [
      '/research Design an implementation plan for adding subscription-gated features to a Next.js + Express app.',
      'Review this architecture and list the top 5 production failure modes with mitigations.',
      'Create a test matrix for billing, auth, entitlements, and webhook reliability.',
    ],
  },
  {
    id: 'ops',
    label: 'Support / Ops',
    description: 'Operational playbooks, incident handling, and customer communication.',
    prompts: [
      '/research Build an incident response runbook for payment failures and webhook outages.',
      'Draft customer-facing status update templates for investigating, identified, and resolved states.',
      'Create a daily reconciliation checklist for payouts, refunds, and subscription anomalies.',
    ],
  },
]
