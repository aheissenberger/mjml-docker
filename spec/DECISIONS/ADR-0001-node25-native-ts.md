# ADR-0001 Node 25 Native TypeScript

## Status

Accepted

## Date

2026-03-25

## Context

The project requires a TypeScript-based HTTP API server. Node.js 25+ provides built-in
type stripping that allows TypeScript source files to be executed directly without a
separate compilation step. This eliminates the need for `ts-node`, `tsx`, Babel, or
any custom loaders.

## Decision

Use Node.js 25+ native TypeScript type stripping for execution. Only syntax that is safe
to strip is permitted (`erasableSyntaxOnly: true` in tsconfig). A local `typescript`
devDependency provides editor IntelliSense and `tsc --noEmit` type checking without
acting as the runtime compiler.

## Consequences

- No build step required for development or deployment
- TypeScript source runs directly: `node src/index.ts`
- `tsc --noEmit` running in CI validates types without emitting files
- Only erasable TypeScript syntax is allowed (no enums with values, no namespaces, etc.)

## Related

- FR-001: HTTP API Server Foundation
- ARD-0001: System Context
