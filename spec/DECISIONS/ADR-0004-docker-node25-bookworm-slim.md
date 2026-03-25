# ADR-0004 Multi-Stage Docker Build with node:25-bookworm-slim

## Status

Accepted (amended 2026-03-25 — see Amendment below)

## Date

2026-03-25

## Context

The service must be containerised (FR-006). Options considered:

1. **Single-stage build on `node:25-bookworm-slim`** — simple but ships devDependencies
   (oxlint, oxfmt, typescript) in the final image, bloating it unnecessarily
2. **Multi-stage build: `node:25-bookworm-slim` builder + `node:25-bookworm-slim` runtime**
   — builder installs all deps; runtime installs production deps only, resulting in a
   leaner final image while still running Node 25
3. **Multi-stage build with `gcr.io/distroless` runtime** — distroless Node images
   currently ship Node 22 LTS, not Node 25; using distroless would require copying the
   Node binary manually, which is fragile and unsupported

## Decision

Use a two-stage Dockerfile:

- **Builder**: `FROM node:25-bookworm-slim AS builder` — installs all dependencies
  (`pnpm install --frozen-lockfile`) and copies the full source tree
- **Runtime**: `FROM node:25-bookworm-slim` — enables corepack, copies `package.json`
  and `pnpm-lock.yaml` from builder, runs `pnpm install --prod --frozen-lockfile` to
  install only production dependencies, then copies `src/` from builder

The runtime stage runs as the non-root `node` user (`USER node`) and sets
`NODE_ENV=production`.

## Consequences

- Final image contains only production node_modules + `src/` + Node 25 runtime
- devDependencies (oxlint, oxfmt, typescript) are not present in the final image
- `node:25-bookworm-slim` is an official Docker Hub image; updates are tracked upstream
- The `pnpm-lock.yaml` lockfile is used in both stages for reproducible installs
- If a future distroless Node 25 image is released, migration is straightforward

## Amendment — 2026-03-25

Base image changed from `node:25-bookworm-slim` to `node:25-trixie-slim` (Debian 13).
`node:25-trixie-slim` does not ship `corepack` by default, so both Dockerfile stages
now install pnpm 10 explicitly via `npm install -g pnpm@10` instead of `corepack enable`.
The multi-stage structure and rationale are otherwise unchanged.

## Related

- FR-006: Dockerfile
- ADR-0001: Node 25 Native TypeScript (explains why Node 25 is required in runtime)
