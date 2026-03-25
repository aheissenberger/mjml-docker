# ADR-0002 MJML npm Package for Email Template Rendering

## Status

Accepted

## Date

2026-03-25

## Context

The service must render MJML email templates to HTML (FR-004). Options considered:

1. **`mjml` npm package** — the official library from the MJML project, synchronous API,
   active maintenance, used by the reference `mjml.io` hosted API
2. **Shell-out to MJML CLI** — calls `mjml` binary via `child_process`; adds OS-level
   dependency, process-spawn overhead, and complicates the Docker image
3. **External HTTP call to mjml.io API** — introduces a network dependency, rate limits,
   latency, and removes the self-hosted privacy value proposition

## Decision

Use the `mjml` npm package as a production dependency. It exposes a synchronous
`mjml2html(input, options)` function that returns `{ html, errors }` directly in-process.
No shell-out or external HTTP call is needed.

## Consequences

- `mjml` is added as a production dependency (`dependencies` in `package.json`)
- The Docker runtime image only needs `mjml` and its transitive dependencies
- All rendering is in-process: no network calls, no shell spawning
- The synchronous API fits perfectly with the existing `node:http` request handler

## Related

- FR-004: MJML Render Endpoint
- ADR-0001: Node 25 Native TypeScript
