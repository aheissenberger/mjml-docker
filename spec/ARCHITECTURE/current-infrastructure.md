# Current Infrastructure

## Runtime

- Node.js 25+
- TypeScript (native type stripping, no build step)
- pnpm package manager

## Process Model

- Single HTTP server process
- Listening on TCP port (default 3000, configurable via `PORT` env var)
- Built with Node built-in `node:http`

## Topology

```
Client → HTTP → node25-ts-api-server (port 3000)
```

## Boundaries

- No database
- JSON-only responses
- Static API key authentication via Bearer token — `API_KEY` env var (FR-005, Proposed)
- MJML npm library for email template rendering — no external HTTP calls (FR-004, Proposed)

## Container Topology (FR-006, FR-007)

```
Client → HTTP → mjml-docker container (node:25-trixie-slim, port 3000)
```

Orchestrated via `compose.yaml` with health check and `restart: unless-stopped` policy.

## Ownership

- Language: TypeScript (strict, NodeNext ESM)
- Runtime: Node.js 25+
- Tooling: oxfmt (format), oxlint (lint + type-aware), tsc (typecheck), node:test (tests)
