# Contributing

## Development Workflow

1. Create a branch for your change.
2. Implement module-first changes in src/core, src/agents, src/services.
3. Keep UI and execution logic separated.
4. Add or update tests in tests/.
5. Run:

```bash
npm run test
npm run lint
npm run preflight:full
```

6. Open pull request with architecture notes.

## Coding Standards

- TypeScript strict types.
- Small focused modules.
- No secrets in client-side code.
- Preserve AGPL obligations and attribution.
