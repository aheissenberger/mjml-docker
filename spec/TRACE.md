# Traceability Matrix

| Requirement | Implementation                                     | Verification          | Notes                                                                                                               |
| ----------- | -------------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------- |
| FR-001      | src/server.ts, src/index.ts                        | pnpm test, smoke test | node:http built-in only; startup validates bounded PORT/runtime tuning env + graceful signal shutdown               |
| FR-002      | src/server.ts                                      | test/server.test.ts   |                                                                                                                     |
| FR-003      | src/server.ts                                      | test/server.test.ts   |                                                                                                                     |
| FR-004      | src/server.ts, src/render-worker.ts, src/index.ts  | test/server.test.ts   | POST /v1/render with body/time/rate limits + cancellation-aware worker-pool backpressure; worker-crash recovery     |
| FR-005      | src/server.ts, src/index.ts                        | test/server.test.ts   | Bearer token auth, timingSafeEqual                                                                                  |
| FR-006      | Dockerfile, .dockerignore                          | —                     | Multi-stage image with prod dependency stage and no runtime installer                                               |
| FR-007      | compose.yaml, README.md, .env.example              | docker compose config | Healthcheck + restart policy + `.env` auto-load + runtime presets + `PORT`-aligned probe                            |
| FR-008      | src/server.ts, docs/api.md                         | test/server.test.ts   | Options allowlist with safe `minify` post-process + strict HTTPS-only font URL (http:// and all non-HTTPS rejected) |
| FR-009      | .github/workflows/docker-publish.yml, package.json | workflow_dispatch     | GH CLI script dispatches manual GHCR publish; pushes version + `latest`                                             |
