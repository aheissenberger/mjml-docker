# Contributing

Thanks for contributing.

## Prerequisites

- Node.js 25+
- pnpm

## Setup

```bash
pnpm install
```

Set the required API key for local runs:

```bash
export API_KEY="your-secret-api-key"
```

## Development commands

```bash
pnpm dev
pnpm lint
pnpm lint:ts
pnpm typecheck
pnpm test
pnpm spec:validate
```

## Pull request expectations

- Keep changes focused and small.
- Add or update tests for behavior changes.
- Update docs when APIs or workflows change.
- Keep spec ledger files in sync when requirements/decisions are affected.
- Ensure CI passes before requesting review.

## Commit and release notes

Use clear, descriptive commit messages. If your change is user-visible, add a changelog entry under `## [Unreleased]` in [CHANGELOG.md](CHANGELOG.md).
