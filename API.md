# API Reference

## Cognitive Execution System (CES) Endpoints

### POST /v1/chat/completions

OpenAI-compatible chat completions endpoint used by the app runtime.

Request:

- messages: `{ role, content }[]`
- model: string
- openrouter_api_key: optional (if not supplied, server/env key path may be used)
- stream: optional boolean
- no_log: optional boolean
- `X-User-Access-Token`: optional JWT access token for authenticated plan enforcement in proxy mode

Response:

- OpenAI-compatible chat completion payload
- `x_ces` metadata object for pipeline internals

Multimodal behavior:

- Frontend supports image/audio/PDF upload.
- PDF text is extracted client-side and appended to user prompt context.
- Image/audio metadata is appended to user prompt context.
- Transport remains text-message compatible with OpenAI chat format.

### POST /v1/chat/live-weather

Live weather lookup for weather prompts.

Request:

- query: string

Response:

- content: string
- model: `live-weather`
- source: `open-meteo`

### POST /v1/ces/chat

Run the full Cognitive Execution System (CES) pipeline.

Request:

- prompt: string
- mode: optional (chat|build|debug|research|decision)

Response:

- intent
- mode
- routeReason
- steps[]
- draft
- refined
- final
- artifacts

### POST /v1/ces/build

Build-focused Cognitive Execution System (CES) execution.

Request:

- idea: string
- stack: optional string

### POST /v1/ces/decision

Rank options for a decision.

Request:

- question: string
- options: string[] (min 2)

## Auth Endpoints

### POST /v1/auth/register

Email/password registration.

### POST /v1/auth/login

Returns accessToken + refreshToken.

### POST /v1/auth/refresh

Refreshes access token.

### GET /v1/auth/me

Returns the authenticated user profile and current subscription payload.

### GET /v1/auth/entitlements

Returns plan-scoped in-app feature entitlements (ULTRAPLINIAN/CONSORTIUM limits and support lane).

### POST /v1/auth/oauth/google

Google OAuth scaffold endpoint.

## Billing Endpoint

### POST /v1/billing/checkout

Creates Stripe checkout session for Pro/Enterprise.

### POST /v1/billing/portal

Creates a self-serve Stripe customer portal session for subscription changes and payment method updates.

Requires server env:

- STRIPE_SECRET_KEY
- STRIPE_PRICE_PRO
- STRIPE_PRICE_ENTERPRISE
- STRIPE_PORTAL_RETURN_URL

Legacy support:

- `STRIPE_PRICE_ULTRA` is still accepted as a fallback for older deployments, but the canonical plan name is `Enterprise`.

## Ops Evidence Endpoints

Enterprise-authenticated operational evidence management.

### GET /v1/ops/stripe-evidence/releases

Lists release bundles under `artifacts/stripe-evidence/<release-tag>/` and missing required artifacts.

### GET /v1/ops/stripe-evidence/:releaseTag

Returns one release summary plus persisted gate status.

### PUT /v1/ops/stripe-evidence/:releaseTag/status

Updates pass/fail gate state:

- webhookReplayCompleted: boolean
- payoutDrillCompleted: boolean
- refundDrillCompleted: boolean
- blockingIssues: string
- finalSignoff: string
- status: pending | pass | fail

### POST /v1/ops/stripe-evidence/:releaseTag/artifact

Writes a text artifact file into the release bundle:

- name: file name
- content: text payload

## Notes

- Existing API key middleware still gates protected routes.
- Keep provider keys on server only.
- For static export deployments, ensure server-only routes are hosted separately.
