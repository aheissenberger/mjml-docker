# Current Infrastructure

## Runtime

- Node.js 26+
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
- Static API key authentication via Bearer token — `API_KEY` env var (FR-005, Done)
- MJML npm library for email template rendering — no external HTTP calls (FR-004, Done)

## Container Topology (FR-006, FR-007)

```
Client → HTTP → mjml-docker container (node:26-trixie-slim, port 3000)
```

Orchestrated via `compose.yaml` with health check and `restart: unless-stopped` policy.
The service publishes its port on `127.0.0.1` only, with resource limits, a read-only root
filesystem, no Linux capabilities, and `no-new-privileges`. Remote access needs a TLS proxy.

## Ownership

- Language: TypeScript (strict, NodeNext ESM)
- Runtime: Node.js 26+
- Tooling: oxfmt (format), oxlint (lint + type-aware), tsc (typecheck), node:test (tests)
