# ADR-0006 Distroless Runtime and Pinned Base Images

## Status

Accepted

## Date

2026-11-05

## Context

The runtime stage used `node:26-trixie-slim`. That image contains `sh`, `npm`, `npx`, and `apt-get`.
An attacker with code execution can use these tools. The application does not need them.

ADR-0004 rejected distroless because no distroless Node 25 image existed. A distroless Node 26 image
on Debian 13 now exists.

The `FROM` lines used floating tags, and the Dockerfile installed a floating pnpm major version. A
rebuild could use different content without a change in the repository.

## Decision

We will use `gcr.io/distroless/nodejs26-debian13:nonroot` for the runtime stage and pin both base images by digest.

## Alternatives considered

| Option                                 | Reason for rejection                                   |
| -------------------------------------- | ------------------------------------------------------ |
| Keep `node:26-trixie-slim` for runtime | The image keeps a shell and package managers.          |
| Delete the tools from the slim image   | This is fragile, and deleted files stay in old layers. |
| Pin tags only, without digests         | A rebuild of a tag can change the content.             |

## Consequences

- The runtime image has no shell, so `docker exec` with `sh` does not work.
- The runtime user is `nonroot` (UID 65532). Mounted files must be readable by this UID.
- The `node` binary is at `/nodejs/bin/node` and is not on `PATH`. The Compose healthcheck uses the full path.
- Dependabot updates the digests. The pnpm version needs a manual update.
- The dependency stage still uses `node:26-trixie-slim`, but this stage is not part of the final image.

## Related

- FR-006: Dockerfile
- FR-007: Docker Compose Runtime
- ADR-0004: Docker Build — node:25-trixie-slim
- ADR-0005: Node 26 LTS Runtime
