# MJML Render API

A minimal, self-hosted REST API that converts [MJML](https://mjml.io)
email templates to responsive HTML. Built on Node.js 26+ with
native TypeScript support — no build step required.

## Requirements

- Node.js 26 or newer
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

The server accepts any non-empty key. Use a strong key outside local development, for
example from `openssl rand -hex 32`.

To keep the key out of the process environment and `docker inspect`, set `API_KEY_FILE` to the path of
a file that contains the key. `API_KEY_FILE` takes priority over `API_KEY`.

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

### Use Published GitHub Image (GHCR)

Publish first (manual dispatch):

```bash
pnpm gh:docker-publish -- <ref>
```

Use `<ref>` as a branch or tag name (for example `master` or `v1.1.0`). Each run pushes a tag
named after the ref, with `/` replaced by `-`. Only runs from `master` or a `v*` tag also update
`latest`.

To check the build and the resolved tags without a push:

```bash
gh workflow run docker-publish.yml --ref <ref> -f dry_run=true
```

Reference the published image as:

```bash
ghcr.io/aheissenberger/mjml-docker:<tag>
```

Examples:

```bash
# Pin to a release tag
docker pull ghcr.io/aheissenberger/mjml-docker:v1.1.0

# Or use latest
docker pull ghcr.io/aheissenberger/mjml-docker:latest

docker run --rm -p 3000:3000 \
  -e API_KEY="your-secret-api-key" \
  ghcr.io/aheissenberger/mjml-docker:latest
```

Compose (without local build):

```yaml
services:
  api:
    image: ghcr.io/aheissenberger/mjml-docker:v1.1.0
    environment:
      API_KEY: ${API_KEY:?API_KEY is required}
      PORT: ${PORT:-3000}
    ports:
      - "${PORT:-3000}:${PORT:-3000}"
```

If the package is private, authenticate first:

```bash
echo "$GITHUB_TOKEN" | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin
```

### Docker Compose

Compose loads `.env` by default (same directory as `compose.yaml`) and
passes the configured variables into the `api` service via
`environment` in `compose.yaml`.

```bash
cp .env.example .env
docker compose up --build
```

`compose.yaml` publishes the port on all host interfaces by default. Set `BIND_ADDRESS` in `.env`
to limit it, for example `BIND_ADDRESS=127.0.0.1`.

**The API uses plain HTTP and has no TLS.** The API key and all MJML content travel unencrypted.
Open the port only in a trusted network or behind a firewall, and note that ports published by
Docker often bypass `ufw`. Use a TLS proxy on untrusted networks. All clients behind a proxy
share one rate-limit bucket, because the server uses the socket address.

The service runs with a read-only filesystem, no Linux capabilities, and
`no-new-privileges`. Set `MEM_LIMIT`, `CPU_LIMIT`, and `PIDS_LIMIT` in `.env` to change the
container limits (defaults: `1g`, `2`, `256`).

Under overload the API returns HTTP 503 with `Rendering timed out`. `RENDER_TIMEOUT_MS` includes the
wait in the queue. More workers and CPUs reduce these errors. In a test with 40 parallel requests of
880 KB, 2 workers with 2 CPUs returned 18 errors, and 4 workers with 4 CPUs and `2g` returned none.

The runtime image is distroless, so it has no shell or package manager. It runs as UID 65532.

#### API key from a file

`compose.secrets.yaml` reads the key from a file. The container user (UID 65532) must be able to read
the file.

```bash
export API_KEY_SECRET_FILE=/etc/mjml-docker/api_key
docker compose -f compose.yaml -f compose.secrets.yaml up -d --build
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
MEM_LIMIT=2g
CPU_LIMIT=4
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

- Missing `API_KEY`: the container exits with an error in `docker compose logs api` and restarts.

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
