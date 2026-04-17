# Release Candidate Cleanup Checklist

Use this checklist before cutting a release candidate so only ship-safe files remain in the working tree.

## Ship-safe files added in this pass

- [api/routes/webspec.ts](../api/routes/webspec.ts)
- [src/lib/webspec.ts](../src/lib/webspec.ts)
- [src/types/webspec.ts](../src/types/webspec.ts)
- [src/store/index.ts](../src/store/index.ts)
- [src/components/ChatInput.tsx](../src/components/ChatInput.tsx)
- [src/components/ChatMessage.tsx](../src/components/ChatMessage.tsx)
- [api/server.ts](../api/server.ts)
- [package.json](../package.json)
- [tests/multimodal-e2e.test.ts](../tests/multimodal-e2e.test.ts)
- [tests/webspec-e2e.test.ts](../tests/webspec-e2e.test.ts)
- [.github/workflows/ci.yml](../.github/workflows/ci.yml)

## Keep out of the release candidate until reviewed

- Broad edits in the HF subtree and the many unrelated `api/`, `src/`, and root files already present in the dirty tree.
- Generated artifacts, local rebrand scripts, and scratch files not required by the launch path.
- Any file not explicitly listed in the ship-safe set above.

## Release gate sequence

1. Verify the working tree only contains approved release files.
2. Run `npm run lint`.
3. Run `npm run test`.
4. Run `npm run build`.
5. Run `npm audit --omit=dev`.
6. Confirm the CI workflow matches the same gate order.
