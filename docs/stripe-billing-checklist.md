# Stripe Billing Deployment Checklist

Use this before launching billing in a real environment.

## Stripe Setup

- Create or confirm the Stripe account is in live mode.
- Add products and prices for `Pro` and `Enterprise`.
- Copy the live price IDs into `STRIPE_PRICE_PRO` and `STRIPE_PRICE_ENTERPRISE`.
- Set `STRIPE_SECRET_KEY` from the live API keys page.
- Configure the payout bank account and payout schedule in the Stripe dashboard.

## App Environment

- Set `NEXT_PUBLIC_STRIPE_LINK_PRO` if you use a hosted Stripe Payment Link for Pro.
- Set `NEXT_PUBLIC_STRIPE_LINK_ENTERPRISE` if Enterprise is handled through a payment link or sales flow.
- Set `STRIPE_SUCCESS_URL` and `STRIPE_CANCEL_URL` to your production billing URLs.
- Set `JWT_SECRET` and refresh token TTL values before enabling paid accounts.

## Webhooks

- Create a production webhook endpoint pointing to `/v1/billing/webhook`.
- Subscribe to these events:
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_failed`
- Set `STRIPE_WEBHOOK_SECRET` from the webhook signing secret.
- Verify webhook delivery in Stripe after one live test payment.

## Validation

- Use the Stripe CLI locally to replay a checkout and a subscription update.
- Confirm the app updates the subscription state in `/billing` after webhook delivery.
- Confirm the user lands on the success URL after checkout.
- Confirm cancellation or failed payment moves the user back to the expected plan state.

## Launch Checks

- Verify payouts reach the correct bank account.
- Verify tax, receipts, and customer emails are enabled if required for your region.
- Verify support contact details are visible somewhere in the product.
- Document refund and cancellation policy before inviting paid users.
- Verify operator access to `Customers`, `Subscriptions`, `Payouts`, and `Refunds` in Stripe roles.
- Run one production dry-run: checkout, portal change, failed payment simulation, and refund.

## Payout and Refund Operations

- Use [docs/stripe-payout-refund-runbook.md](docs/stripe-payout-refund-runbook.md) as the source of truth for operators.
- Capture release artifacts with [docs/stripe-production-evidence.md](docs/stripe-production-evidence.md).
- Store payout schedule decisions in your internal operations notes.
- For each refund, record reason code, amount, owner, and support ticket link.
- Reconcile payout and refund totals at the end of each billing cycle.