# Requirements Summary

Human-readable summary and migration source.  
Source of truth: `spec/requirements/*.md`

## Functional Requirements

### FR-001 HTTP API Server Foundation

The service must start an HTTP server listening on a configurable port (default 3000
via `PORT` environment variable) and respond to HTTP requests with JSON content.

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

### FR-007 Docker Compose Runtime

The repository must include a Compose definition (`compose.yaml` preferred) to run the API
service with a configured health check and restart policy. The service must provide required
runtime environment (including `API_KEY`) and host port mapping so the container can be
started and monitored with standard `docker compose` workflows.
