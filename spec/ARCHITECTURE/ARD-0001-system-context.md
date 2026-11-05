# ARD-0001 System Context

## Status

Accepted

## Context

The system is a lightweight HTTP API server built on Node.js 26+ with native TypeScript
support. It is dependency-light and uses only Node built-in modules for the HTTP runtime.

## Decisions

- Single-process HTTP server using `node:http`
- No external runtime dependencies
- TypeScript source run directly with Node's native type stripping
- JSON-only response format

## Related

- ADR-0001: Node 25 Native TypeScript execution
- ADR-0005: Node 26 LTS Runtime
- FR-001: HTTP API Server Foundation
