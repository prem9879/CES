# Project Genesis

This document turns the build philosophy into a repeatable workflow for this repo.

## Use It Like This

When you want new work, ask in this format:

- `Build me a [type] that [solves problem] for [target users]`
- `Build me a CLI that [action] using [method] better than [existing]`
- `Build me an API that [provides] with [unique approach]`

## Working Rules

- Search the current codebase first, then change the smallest surface that controls the behavior.
- Prefer original architecture, naming, and UX instead of clone-like patterns.
- Keep required open-source attribution and license notices intact.
- Use `npm run preflight:full` before release changes and `npm run build` before deploys.

## Differentiation Checklist

For every feature, check:

- Is it unique?
- Is it valuable?
- Is it feasible?
- Is it defensible?
- Is it delightful?

## Delivery Pattern

1. Research the closest existing solutions.
2. Identify what they miss.
3. Design the simplest strong version of the missing idea.
4. Implement it in the repo with consistent naming and UX.
5. Validate it with a build or focused preflight.

## Originality Guardrails

- Do not claim authorship of third-party work you did not create.
- Do not remove required license notices.
- Replace placeholder brand assets, examples, and copy with your own where appropriate.
- Keep public-facing claims accurate and verifiable.
