# Requirements Summary

Human-readable summary and migration source.  
Source of truth: `spec/requirements/*.md`

## Functional Requirements

### FR-001 HTTP API Server Foundation

The service must start an HTTP server listening on a configurable port (default 3000
via `PORT` environment variable) and respond to HTTP requests with JSON content.
Invalid port configuration must fail fast at startup.
Optional worker tuning environment variables must be validated at startup.
Runtime tuning values use bounded validation ranges to prevent unsafe configuration.
Signal-driven shutdown should drain idle connections and terminate within a bounded grace window.

### FR-002 Health Check Endpoint

The server must expose `GET /health` returning `{ "status": "ok" }` with HTTP 200.

### FR-003 Root Info Endpoint

The server must expose `GET /` returning server name, a descriptive message, and list
of available endpoints as JSON.

### FR-004 MJML Render Endpoint

The server must expose `POST /v1/render` accepting an MJML template string in the
request body (`{ "mjml": "<string>" }`) and returning the compiled HTML
(`{ "html": "<string>", "errors": [] }`). Rendering is performed by the `mjml` npm
package.
The endpoint enforces request size/time limits and treats internal render/minify failures
as server errors.
Rendering uses bounded worker-pool backpressure and may return HTTP 503 under overload.
Worker-pool size, queue length, and timeout are configurable via validated environment variables.
Per-client rate limiting is enforced and overload from client bursts returns HTTP 429.

### FR-005 API Key Authentication

All non-health endpoints must be protected by a static API key supplied as
`Authorization: Bearer <key>`. The key is read from the `API_KEY` environment variable.
Unauthorised requests receive HTTP 401. Key comparison uses constant-time equality to
prevent timing attacks (`node:crypto` `timingSafeEqual`).

### FR-006 Dockerfile

The repository must ship a multi-stage `Dockerfile` based on `node:25-trixie-slim`.
The builder stage installs dependencies (pnpm installed via `npm install -g pnpm@10`);
the runtime stage copies only production files, runs as the non-root `node` user, sets
`NODE_ENV=production`, and exposes port 3000. A `.dockerignore` file excludes
non-runtime artefacts (`.git`, `spec/`, `test/`, etc.).
Production dependencies are prepared in a build stage and copied into runtime without
running package manager install commands in the final image stage.

### FR-007 Docker Compose Runtime

The repository must include a Compose definition (`compose.yaml` preferred) to run the API
service with a configured health check and restart policy. The service must provide required
runtime environment (including `API_KEY`) and host port mapping so the container can be
started and monitored with standard `docker compose` workflows.
A sample `.env.example` must document required and optional runtime variables.
Compose usage should load `.env` automatically and document development vs production-style presets.
The healthcheck probe must align with the configured in-container `PORT` so non-default ports remain healthy.

### FR-008 Request-Scoped MJML Options

The render endpoint may accept an optional `options` object alongside `mjml` so callers can
request a constrained subset of MJML render behaviour per API call. Only serializable,
request-local options are in scope; filesystem-backed, config-backed, function-valued,
deprecated, undocumented, or contract-breaking MJML options remain disallowed. A request-level
`minify` boolean may trigger safe post-processing of rendered HTML output.
Custom font URLs must be valid absolute `https://` URLs.
