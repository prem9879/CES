# Release Artifact Policy

## Goal

Keep release branches clean, reproducible, and minimal.

## Must Be Tracked

- Source code under `src/`, `api/`, `functions/` (if used)
- Configuration files (`package.json`, `tsconfig.json`, `next.config.js`, etc.)
- Documentation (`README.md`, `SECURITY.md`, `docs/*`)
- Licensing/legal files (`LICENSE`, `NOTICE`, policy pages)

## Must Not Be Tracked

- Dependency folders (`node_modules/`)
- Build outputs (`.next/`, `out/`, `dist/`, `build/`)
- Local env and secrets (`.env*`)
- Large transient reports unless intentionally versioned release evidence

## Minimal Distributable Tree (Recommended)

- `src/`
- `api/`
- `public/`
- `docs/`
- Root configs and lockfile
- Legal and policy docs

## Pre-Push Check

```bash
git status --short
npm run lint
npm run build
npm audit --omit=dev
```

## CI/CD Recommendation

Add a pipeline step that fails if generated artifacts appear in diff unexpectedly.
