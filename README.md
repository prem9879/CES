# Cognitive Execution System (CES)

CES is a production-oriented AI execution workspace.

It combines:
- Multi-model chat and orchestration
- Plan-based feature enforcement (Free, Pro, Enterprise)
- Billing and entitlement-aware runtime behavior
- Enterprise operational evidence workflows

## Why CES Is Different

Most AI apps stop at chat UI + model call.

CES is built as a complete operating system for AI product delivery:
- Runtime intelligence (routing, fusion, orchestration)
- Revenue intelligence (billing + hard-fail entitlements)
- Ops intelligence (release evidence and signoff workflows)

## Core Capabilities

- 53 selectable UI models across providers
- 10 virtual orchestration models (`ultraplinian/*`, `consortium/*`)
- ULTRAPLINIAN race mode (parallel responses, best-result progression)
- CONSORTIUM synthesis mode (collective model consensus and distillation)
- Persona-aware interaction layer
- Role-based onboarding prompt packs
- Stripe checkout and customer portal integration
- Enterprise evidence APIs and admin dashboard
- Support, privacy, terms, and offline surfaces

## Architecture At A Glance

CES is organized into four practical layers:
- Experience layer: app shell, chat canvas, billing, support, and admin evidence
- Orchestration layer: intent routing, mode routing, and model/persona selection
- Execution layer: OpenRouter, proxy fallback, race mode, and consortium synthesis
- Trust layer: entitlements, release evidence, policy pages, and offline support

See the live architecture view in the app at `/architecture/`.

### Real Features Already Wired

- ULTRAPLINIAN race mode with alternate-response navigation
- CONSORTIUM synthesis mode for multi-model distillation
- Proxy fallback runtime when a personal API key is missing
- Service worker support with offline surface and app manifest
- Billing, auth, support, and evidence pages already routed

## Product Modes

- Chat
- Build
- Debug
- Research
- Decision

## Local Run (Working Setup)

Use two terminals.

### Terminal 1: API server

```bash
npm install
npm run api:dev
```

### Terminal 2: Frontend

```bash
npm run dev
```

Frontend:
- http://localhost:3000

API base expected by frontend:
- http://localhost:7860

## Environment

Copy example env and fill values:

```bash
cp .env.example .env.local
```

Important variables:
- `NEXT_PUBLIC_API_BASE_URL`
- `JWT_SECRET`
- `STRIPE_SECRET_KEY`
- `STRIPE_PRICE_PRO`
- `STRIPE_PRICE_ENTERPRISE`
- `STRIPE_WEBHOOK_SECRET`

## Quality Gates

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm audit --omit=dev
```

## API Snapshot

Main routes:
- `POST /v1/chat/completions`
- `POST /v1/ultraplinian/completions`
- `POST /v1/consortium/completions`
- `GET /v1/models`
- `GET /v1/tier`
- `GET /v1/auth/entitlements`
- `POST /v1/billing/checkout`
- `POST /v1/billing/portal`
- `GET /v1/ops/stripe-evidence/releases`

See `API.md` for full details.

## Two New Science Inventions (R&D Tracks)

These are original invention tracks you can develop as real science and engineering programs.

### 1) Living Thermal Battery Concrete (LTBC)

What it is:
- A structural concrete system that stores daytime heat as reversible chemical potential in embedded thermochemical microcapsules, then releases heat at night through controlled hydration.

Core novelty:
- Structural material + thermal battery in one body.
- Reversible salt-hydrate chemistry inside a load-bearing matrix.
- Triggered heat release via humidity control channels.

Why it matters:
- Reduces night heating load without bulky external thermal tanks.
- Improves passive resilience for buildings during power interruptions.
- Enables climate-adaptive wall and slab systems.

### 2) Spectral Fog-to-Water Metamaterial Skin (SFMS)

What it is:
- A roof or facade skin that combines radiative cooling microtextures with directional nano-wetting channels to condense and transport water from humid air and fog, day and night.

Core novelty:
- Joint optimization of emissivity spectrum and capillary transport geometry.
- Dual-regime operation: fog capture at high RH and dew condensation at moderate RH.
- Passive gravity-assisted collection with no moving parts.

Why it matters:
- Creates distributed non-grid water generation surfaces.
- Supports drought-prone or remote infrastructure.
- Adds water-harvesting functionality to standard envelope materials.

See docs/SCIENCE-INVENTIONS.md for mechanism, validation plan, and technical risks.

## Security and Legal

- License: AGPL-3.0 (`LICENSE`)
- Security policy: `SECURITY.md`
- Credits and derivative note: `CREDITS.md`

## Navigation

- `/` workspace
- `/architecture/` system map
- `/billing/` plan and checkout flow
- `/admin/evidence/` release evidence surface
- `/support/` user support surface

## Release Checklist Before Push

- [ ] Lint passes
- [ ] Typecheck passes
- [ ] Build passes
- [ ] No secrets committed
- [ ] Billing envs configured
- [ ] README and legal docs reviewed

## Attribution

CES is presented as the primary product and codebase in this repository.
One concise inspiration credit is retained in `CREDITS.md`; all public-facing branding, UX, and release copy should remain CES-first.
