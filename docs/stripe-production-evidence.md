# Stripe Production Evidence Capture

Use this checklist to capture release-quality evidence for live Stripe operations.

Production runtime hardening reference: `docs/stripe-production-runtime-config.md`.

## Evidence Bundle

Store artifacts under `artifacts/stripe-evidence/<release-tag>/`:

- `webhook-replay.log`: Output from webhook replay validation.
- `subscription-sync.json`: API snapshot after replay (`/v1/billing/subscription`).
- `payout-drill.log`: Payout verification drill notes and transaction IDs.
- `refund-drill.log`: Refund simulation drill notes and transaction IDs.
- `operator-signoff.md`: Date, owner, and release signoff.

## Webhook Replay Drill

1. Confirm production webhook endpoint is reachable and has signing secret configured.
2. Trigger replay for representative events from Stripe dashboard:
- `customer.subscription.created`
- `customer.subscription.updated`
- `invoice.payment_failed`
3. Verify API user subscription status reflects expected state.
4. Save event IDs, timestamps, and response codes in `webhook-replay.log`.

## Payout Drill

1. Open Stripe payouts dashboard and capture latest payout IDs and status.
2. Confirm internal ledger/reconciliation matches Stripe payout totals.
3. Record any discrepancies and remediation owner in `payout-drill.log`.

## Refund Drill

1. Select a low-risk charge in production.
2. Initiate a controlled partial or full refund per policy.
3. Verify webhook flow updates internal state and audit trail.
4. Log charge ID, refund ID, operator, and outcome in `refund-drill.log`.

## Operator Signoff Template

```markdown
# Stripe Ops Signoff

- Release tag:
- Date (UTC):
- Operator:
- Webhook replay completed: yes/no
- Payout drill completed: yes/no
- Refund drill completed: yes/no
- Blocking issues:
- Final signoff:
```
