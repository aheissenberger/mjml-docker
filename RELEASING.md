# Releasing

This document defines the release process for this repository.

## Prerequisites

- Push access to the repository
- Green CI on the release commit
- Local environment with Node.js 25+ and pnpm

## 1. Prepare release changes

1. Update [CHANGELOG.md](CHANGELOG.md) from `Unreleased` with release notes.
2. Run validation locally:

```bash
pnpm install
pnpm lint
pnpm lint:ts
pnpm typecheck
pnpm test
pnpm spec:validate
```

## 2. Create and push tag

1. Choose a SemVer tag (for example `v1.0.0`).
2. Tag and push:

```bash
git tag v1.0.0
git push origin v1.0.0
```

## 3. Publish GitHub release

- Tag push triggers the release workflow.
- Verify the generated GitHub Release notes and edit if needed.

## 4. Post-release checks

- Confirm release artifacts and notes are complete.
- Verify README and docs links resolve correctly.
- Confirm container users can build and run from the released tag.
