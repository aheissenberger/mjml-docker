# MJML Render API

A minimal, self-hosted REST API that converts [MJML](https://mjml.io)
email templates to responsive HTML. Built on Node.js 25+ with
native TypeScript support — no build step required.

## Requirements

- Node.js 25 or newer
- pnpm

## Setup

```bash
pnpm install
cp .env.example .env
```

Set configuration variables in `.env` (or export them in your shell):

```bash
export API_KEY="your-secret-api-key" # required
```

## Run

```bash
pnpm start
```

The server listens on `http://localhost:3000` by default. Set `PORT` to change it.

Optional worker-pool tuning:

- `RENDER_WORKERS` (integer >= 1): number of render worker threads
- `RENDER_QUEUE_SIZE` (integer >= 0): bounded queue length before HTTP 503 backpressure
- `RENDER_TIMEOUT_MS` (integer >= 1): per-request render timeout in milliseconds
- `RATE_LIMIT_MAX_REQUESTS` (integer >= 1): max requests per client in each rate-limit window
- `RATE_LIMIT_WINDOW_MS` (integer >= 1): rate-limit window size in milliseconds

## Docker

```bash
docker build -t mjml-api .

docker run -p 3000:3000 -e API_KEY="your-secret-api-key" mjml-api
```

### Docker Compose

Compose loads `.env` by default (same directory as `compose.yaml`) and
passes the configured variables into the `api` service via
`environment` in `compose.yaml`.

```bash
cp .env.example .env
docker compose up --build
```

#### Local Presets

Development-style preset (fewer workers, shorter timeout):

```bash
cp .env.example .env
cat > .env <<'EOF'
API_KEY=dev-secret-key
PORT=3000
RENDER_WORKERS=1
RENDER_QUEUE_SIZE=16
RENDER_TIMEOUT_MS=10000
RATE_LIMIT_MAX_REQUESTS=120
RATE_LIMIT_WINDOW_MS=60000
EOF
docker compose up --build
```

Production-style preset (more workers, larger queue):

```bash
cp .env.example .env
cat > .env <<'EOF'
API_KEY=replace-with-strong-secret
PORT=3000
RENDER_WORKERS=4
RENDER_QUEUE_SIZE=128
RENDER_TIMEOUT_MS=30000
RATE_LIMIT_MAX_REQUESTS=240
RATE_LIMIT_WINDOW_MS=60000
EOF
docker compose up -d --build
```

Check health status:

```bash
docker compose ps
```

Expected result: the `api` service status becomes `healthy`.

Stop and remove containers:

```bash
docker compose down
```

Troubleshooting:

- Missing `API_KEY`:

  ```bash
  cp .env.example .env
  # then edit .env and set API_KEY
  docker compose up --build
  ```

- Port `3000` already in use:

  ```bash
  lsof -nP -iTCP:3000 -sTCP:LISTEN
  ```

  Stop the process using port `3000`, or change the mapping in
  `compose.yaml` from `3000:3000` to `3001:3000` and restart Compose.

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

All endpoints except `GET /health` require
`Authorization: Bearer <API_KEY>`.

See [docs/api.md](docs/api.md) for the full API reference,
including all request/response shapes and error codes.

## Development

```bash
pnpm dev        # watch mode
pnpm typecheck  # type check
pnpm lint       # lint
pnpm lint:ts    # TypeScript lint
pnpm format     # format
pnpm test       # run tests
```
