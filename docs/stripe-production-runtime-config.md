# Stripe Production Runtime Configuration

Use this checklist to configure Stripe securely in your deployment environment.

## Required Environment Variables

- STRIPE_SECRET_KEY: use `sk_live_...` for production.
- STRIPE_WEBHOOK_SECRET: use the `whsec_...` value from the production webhook endpoint.
- STRIPE_PRICE_PRO: live recurring price ID for Pro plan.
- STRIPE_PRICE_ENTERPRISE: live recurring price ID for Enterprise plan.
- STRIPE_SUCCESS_URL: HTTPS URL for billing success redirect.
- STRIPE_CANCEL_URL: HTTPS URL for billing cancellation redirect.
- STRIPE_PORTAL_RETURN_URL: HTTPS URL for portal return flow.
- JWT_SECRET: long random secret for auth token signing.

## Secure Handling Rules

- Never commit live Stripe secrets to source control.
- Store secrets in deployment secret manager only.
- Restrict secret visibility to runtime identity and on-call operators.
- Rotate STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET on schedule and after incidents.
- Keep separate credentials for dev, staging, and production.
- Require TLS for all webhook and redirect endpoints.

## Minimal Verification Commands

Run from deployment shell where runtime env is loaded:

```powershell
if ($env:STRIPE_SECRET_KEY -match '^sk_live_') { 'STRIPE_SECRET_KEY=live' } else { 'STRIPE_SECRET_KEY=invalid' }
if ($env:STRIPE_WEBHOOK_SECRET -match '^whsec_') { 'STRIPE_WEBHOOK_SECRET=set' } else { 'STRIPE_WEBHOOK_SECRET=invalid' }
if ($env:STRIPE_PRICE_PRO) { 'STRIPE_PRICE_PRO=set' } else { 'STRIPE_PRICE_PRO=missing' }
if ($env:STRIPE_PRICE_ENTERPRISE) { 'STRIPE_PRICE_ENTERPRISE=set' } else { 'STRIPE_PRICE_ENTERPRISE=missing' }
```

## Release Readiness Tie-in

After runtime config is validated, execute the operational checklist in:

- docs/stripe-production-evidence.md

Then publish pass or fail evidence via the internal page:

- /admin/evidence
