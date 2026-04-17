# Deployment Playbook

## 1) Pre-Deploy Gates

Run from project root:

```bash
npm install
npm run lint
npm run build
npm audit --omit=dev
```

## 2) Required Environment Variables

- `OPENROUTER_API_KEY` (or user-supplied per request)
- `OPENAI_API_KEY` (required for high-quality audio transcription endpoint)
- `NODE_ENV=production`
- `NEXT_PUBLIC_SITE_URL` for canonical URLs/sitemap

Optional:

- `NEXT_STATIC_EXPORT=false` if deploying server runtime with dynamic headers

## 3) Runtime Modes

- Static export (default): `output: export`
- Server mode: set `NEXT_STATIC_EXPORT=false`

## 4) API Startup

```bash
npm run api
```

Health checks:

- `GET /v1/health`
- `GET /v1/info`
- `GET /v1/models`

## 5) Frontend Startup

```bash
npm run start
```

## 6) Release Branch Hygiene

Before push:

1. Ensure build artifacts are ignored (`.next/`, `out/`, `node_modules/`)
2. Confirm no secrets in tracked files
3. Keep docs in `docs/` aligned with deployed behavior
4. Tag release with changelog notes for security/multimodal changes

## 7) Rollback Plan

1. Keep previous release tag and image/artifact
2. Revert deployment target to prior tag
3. Validate `/v1/health` and smoke test chat path
4. Re-run audit and incident notes if rollback was security-driven
