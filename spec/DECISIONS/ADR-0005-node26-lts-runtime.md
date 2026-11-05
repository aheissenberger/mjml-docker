# ADR-0005 Node 26 LTS Runtime

## Status

Accepted

## Date

2026-11-05

## Context

ADR-0001 and ADR-0004 set Node 25 as the runtime and `node:25-trixie-slim` as the base image.
Node 25 reached end of life on 2026-06-01. It gets no more security fixes. The last rebuild of
`node:25-trixie-slim` was on 2026-05-20, so its Debian packages are also old.

Node 26 became LTS on 2026-10-28. Node 26 has support until 2029-04-30.

## Decision

We will use Node 26 LTS as the minimum runtime and `node:26-trixie-slim` as the base image.

## Alternatives considered

| Option                | Reason for rejection                                       |
| --------------------- | ---------------------------------------------------------- |
| Stay on Node 25       | Node 25 gets no security fixes.                            |
| Move to Node 24 LTS   | Node 24 support ends on 2028-04-30, one year before Node 26. |
| Move to Node 27       | Node 27 has only alpha releases.                           |

## Consequences

- The Dockerfile, the CI workflows, and `engines` in `package.json` use Node 26.
- The Dockerfile installs pnpm 12, the same major version as the local tooling.
- Native type stripping and the multi-stage build do not change. ADR-0001 and ADR-0004 stay
  valid for these decisions.
- Installations on Node 25 no longer meet the `engines` range.

## Related

- FR-006: Dockerfile
- ADR-0001: Node 25 Native TypeScript
- ADR-0004: Docker Build — node:25-trixie-slim
