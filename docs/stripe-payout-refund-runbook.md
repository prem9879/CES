# Stripe Payout and Refund Runbook

This runbook is for operators managing live billing incidents and routine payout operations.

## Access and Ownership

- Required Stripe permissions: `View balances`, `Manage payouts`, `View customers`, `Manage refunds`.
- Assign an owner for each shift/week to avoid unclear payout/refund responsibility.
- Keep a backup owner for escalation coverage.

## Daily Payout Routine

1. Open Stripe Dashboard -> Balances -> Payouts.
2. Verify expected payout status for the day (`pending`, `in_transit`, `paid`, or `failed`).
3. If a payout fails, open the payout detail and capture the failure reason.
4. Notify finance/support and open an incident ticket with payout ID and failure reason.
5. Confirm payout retries or corrected bank details before closing the incident.

## Refund Workflow

1. Confirm refund eligibility against your public refund policy.
2. Open Stripe Dashboard -> Customers -> select customer -> Payment.
3. Choose `Refund` and select:
   - full vs partial amount
   - reason code (`duplicate`, `fraudulent`, `requested_by_customer`)
4. Add internal note with support ticket ID and operator name.
5. Send customer confirmation using your support template.

## Incident Handling: Payment Failed / Dunning

1. Monitor `invoice.payment_failed` events in Stripe webhook logs.
2. Verify CES subscription state switches to `past_due`.
3. Confirm Stripe dunning emails are sent.
4. If recovery fails after dunning window, downgrade account according to policy.

## Month-End Reconciliation

1. Export Stripe balance transaction report.
2. Compare gross charges, refunds, fees, and net payouts against internal ledger.
3. Review top refund reasons and identify prevention actions.
4. Archive reconciliation report with links to incident/support tickets.

## Audit Evidence Checklist

- Screenshot or export of payout schedule settings.
- Weekly payout status summary.
- Refund log with reason and ticket traceability.
- Proof of webhook delivery health for billing events.
