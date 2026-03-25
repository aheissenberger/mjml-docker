# ADR-0003 Static API Key Authentication

## Status

Accepted

## Date

2026-03-25

## Context

The service must restrict access to its rendering endpoint (FR-005). Options considered:

1. **No authentication** — suitable only for fully private/isolated networks; ruled out
   because the service may be exposed on a Docker host network
2. **Static API key via Bearer token** — a single secret read from `API_KEY` env var;
   simple to configure in container orchestration, matches the `mjml.io` hosted API model
3. **JWT / OAuth** — adds significant complexity, requires a token issuer, overkill for a
   single-tenant self-hosted service

## Decision

Use a static API key supplied as `Authorization: Bearer <key>` validated against the
`API_KEY` environment variable. Comparison uses `node:crypto` `timingSafeEqual` to
prevent timing attacks. The server refuses to start if `API_KEY` is not set.

## Consequences

- Simple deployment: set one env var
- No token rotation without a restart
- Not suitable for multi-tenant or public-facing deployments without additional controls
- `API_KEY` must never be logged or reflected in any response body
- Only `GET /health` is exempt; all other routes require the key

## Related

- FR-005: API Key Authentication
- FR-004: MJML Render Endpoint (protected endpoint)
- FR-003: Root Info Endpoint (protected endpoint)
