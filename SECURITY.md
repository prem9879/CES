# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in CES, please report it responsibly.

**Please do NOT open a public GitHub issue for security vulnerabilities.**

### What to include

- Description of the vulnerability
- Steps to reproduce
- Impact assessment
- Suggested fix (if you have one)

### Response timeline

- **Acknowledgement:** within 48 hours
- **Initial assessment:** within 7 days
- **Fix or mitigation:** within 30 days for critical issues

## Scope

In scope:

- The CES API server (`api/`)
- The frontend application (`src/`)
- Docker / deployment configuration
- Authentication and authorization logic

Out of scope:

- Third-party dependencies (report upstream, but let us know)
- Social engineering attacks
- Denial of service attacks against hosted instances

## Supported Versions

| Version | Supported |
| --- | --- |
| 0.5.x | Yes |
| < 0.5 | No |

## Security Design

- **Authentication:** Bearer token with constant-time comparison (timing-attack resistant)
- **Rate limiting:** Tier-aware sliding window (per-minute + per-day + lifetime)
- **Headers:** HSTS, CSP, X-Content-Type-Options, X-Frame-Options, Permissions-Policy
- **Docker:** Non-root containers, minimal base images
- **Data:** Zero PII storage, opt-in dataset collection only

## Operational Security Baseline

Run these checks before release:

```bash
npm run lint
npm run build
npm audit --omit=dev
```

## Key Management Expectations

- Never commit provider secrets in source, history, or docs.
- Use runtime environment variables for server keys.
- BYOK mode is supported; user keys remain user-managed.
