# CES Launch Checklist (Next-Level)

## Deployment Gate Commands

- [ ] Run `npm run preflight` (baseline structure/wiring checks).
- [ ] Run `npm run preflight:live` (provider reachability + live status report).
- [ ] Optional strict mode: set `PREFLIGHT_STRICT_LIVE=true` to fail on warnings.
- [ ] Fast path: run `npm run preflight:full` before every deploy.
- [ ] Review generated reports in `artifacts/reports/live-systems-report.md` and `.json`.
- [ ] If you need runtime security headers in production, set `NEXT_STATIC_EXPORT=false`.

## Legal & Compliance

- [ ] Update and review Privacy Policy in `src/app/privacy-policy/page.tsx` with your legal contact details.
- [ ] Update Terms in `src/app/terms/page.tsx` with business entity name and jurisdiction.
- [ ] Keep Cookies Policy in `src/app/cookies-policy/page.tsx` aligned with active trackers.
- [ ] Verify cookie consent appears on first visit and analytics do not fire before consent.

## Originality & IP Hygiene

- [ ] Run `npm run preflight:live` and review the "Brand uniqueness scan" result.
- [ ] Replace legacy upstream identity tokens flagged in `artifacts/reports/live-systems-report.md`.
- [ ] Keep required open-source license notices for third-party dependencies and inherited code.
- [ ] Replace placeholder brand assets (name, logos, copy, examples, screenshots) with your own originals.
- [ ] Confirm your final public claim language does not imply ownership of third-party code you did not author.

## Auth & Security

- [ ] Configure Supabase env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- [ ] In Supabase Auth, enable Email provider and require email confirmation.
- [ ] Test signup -> email verify -> login flow using `/auth`.
- [ ] Test password reset email and update flow using `/auth/reset`.
- [ ] Enable Google OAuth in Supabase and verify callback URLs.
- [ ] Add CAPTCHA/challenge in auth provider settings to reduce brute force risk.
- [ ] Verify API/server-side rate limiting if backend auth endpoints are added.

## Payment

- [ ] Set `NEXT_PUBLIC_STRIPE_LINK_PRO` and `NEXT_PUBLIC_STRIPE_LINK_ENTERPRISE`.
- [ ] Test checkout success and canceled flows using Stripe hosted links.
- [ ] Configure Stripe customer portal and add downgrade/cancel URL path.
- [ ] Enable failed payment recovery and email reminders.
- [ ] If enabling server mode: add Stripe webhook for subscription state sync.

## User Event Tracking

- [ ] Set `NEXT_PUBLIC_GA_MEASUREMENT_ID` and/or `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`.
- [ ] Verify page tracking after consent (home, auth, billing, legal pages).
- [ ] Track key events: signup started/completed, upgrade click, checkout success/cancel.

## Marketing & SEO

- [ ] Set `NEXT_PUBLIC_SITE_URL` to production domain.
- [ ] Verify generated `robots.txt` and `sitemap.xml`.
- [ ] Submit sitemap to Google Search Console.
- [ ] Submit sitemap to Bing Webmaster Tools and other relevant engines.
- [ ] Add canonical domain and ensure HTTPS-only routing.
- [ ] Review title/meta/OG tags for key pages.

## Production Testing

- [ ] Run `npm run build` and resolve all warnings/errors.
- [ ] Test mobile/desktop responsiveness for auth, billing, legal pages.
- [ ] Run a privacy review: no keys in client logs, no unexpected tracking.
- [ ] Perform smoke tests for core chat mode and new pages after deployment.
