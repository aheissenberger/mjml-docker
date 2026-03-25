# MJML Render API

A minimal, self-hosted REST API that converts [MJML](https://mjml.io) email templates to responsive HTML. Built on Node.js 25+ with native TypeScript support — no build step required.

## Requirements

- Node.js 25 or newer
- pnpm

## Setup

```bash
pnpm install
```

Set a required environment variable before starting:

```bash
export API_KEY="your-secret-api-key"
```

## Run

```bash
pnpm start
```

The server listens on `http://localhost:3000` by default. Set `PORT` to change it.

## Docker

```bash
docker build -t mjml-api .

docker run -p 3000:3000 -e API_KEY="your-secret-api-key" mjml-api
```

## Quick usage example

```bash
curl -X POST http://localhost:3000/v1/render \
  -H "Authorization: Bearer your-secret-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "mjml": "<mjml><mj-body><mj-section><mj-column><mj-text>Hello!</mj-text></mj-column></mj-section></mj-body></mjml>"
  }'
```

```json
{
  "html": "<!doctype html><html>...</html>",
  "errors": []
}
```

All endpoints except `GET /health` require the `Authorization: Bearer <API_KEY>` header.

See [docs/api.md](docs/api.md) for the full API reference including all request/response shapes and error codes.

## Development

```bash
pnpm dev        # watch mode
pnpm typecheck  # type check
pnpm lint       # lint
pnpm lint:ts    # TypeScript lint
pnpm format     # format
pnpm test       # run tests
```
