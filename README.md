# Node 25 Native TypeScript API Server

A minimal API server that runs TypeScript directly on Node.js 25+ using built-in type stripping.

## Requirements

- Node.js 25 or newer
- pnpm

## Install

```bash
pnpm install
```

## Run

```bash
pnpm start
```

The server listens on `http://localhost:3000` by default.

### Endpoints

- `GET /` - basic server info
- `GET /health` - health check

## Development

```bash
pnpm dev
```

## Type Checking

```bash
pnpm typecheck
```

## Linting

```bash
pnpm lint
pnpm lint:ts
```

## Formatting

```bash
pnpm format
```

## Tests

```bash
pnpm test
```
