# Project Guidelines

## Build and Test

- Install dependencies with `pnpm install`.
- Run the API server with `pnpm start`.
- Use watch mode with `pnpm dev`.
- Format code with `pnpm format`.
- Run lint checks with `pnpm lint` and `pnpm lint:ts`.
- Run type checks with `pnpm typecheck`.
- Run tests with `pnpm test`.

## Runtime Conventions

- This project targets Node.js 25+ and runs `.ts` files directly with Node's native type stripping.
- Do not introduce `ts-node`, `tsx`, Babel, or custom loaders for server execution.
- Prefer Node built-in modules (for example `node:http`, `node:test`) before adding third-party dependencies.

## Code Conventions

- Keep the API server simple and dependency-light unless requirements justify adding packages.
- Use ESM imports and preserve explicit `.ts` extension support for local imports.
- Keep OXC formatter and linter configs (`.oxfmt.json`, `.oxlintrc.json`) as source of truth for style and lint rules.
- Keep examples and setup docs aligned with [README.md](README.md).

## Requirement and Decision Process

- Use spec ledger files under `spec/`.
- Keep one requirement file per ID: `spec/requirements/FR-NNN.md`.
- Treat `spec/requirements/index.md` as generated output — do not edit manually in PRs.
- Add append-only trace event files in `spec/trace/events/` for every requirement-related change.
- Add append-only claim lifecycle files (`claim/heartbeat/release/override`) in `spec/trace/claims/` for worktree ownership coordination.
- Update `spec/TRACE.md` for requirement-to-implementation mapping.
- Create or update ADRs under `spec/DECISIONS/` for significant design or architecture decisions.
- Keep `spec/ARCHITECTURE/current-infrastructure.md` current for agent onboarding.
- Never mark requirements Done without verification evidence.
- Run `pnpm spec:validate` to check requirement files, index parity, and trace events.

## Requirement and Decision Process

- Use spec ledger files under `spec/`.
- Keep one requirement file per ID: `spec/requirements/FR-NNN.md`.
- Treat `spec/requirements/index.md` as generated output — do not edit manually in PRs.
- Add append-only trace event files in `spec/trace/events/` for every requirement-related change.
- Add append-only claim lifecycle files (`claim/heartbeat/release/override`) in `spec/trace/claims/` for worktree ownership coordination.
- Update `spec/TRACE.md` for requirement-to-implementation mapping.
- Create or update ADRs under `spec/DECISIONS/` for significant design or architecture decisions.
- Keep `spec/ARCHITECTURE/current-infrastructure.md` current for agent onboarding.
- Never mark requirements Done without verification evidence.
- Run `pnpm spec:validate` to check requirement files, index parity, and trace events.
