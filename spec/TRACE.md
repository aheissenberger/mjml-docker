# Traceability Matrix

| Requirement | Implementation              | Verification          | Notes                                |
| ----------- | --------------------------- | --------------------- | ------------------------------------ |
| FR-001      | src/server.ts, src/index.ts | pnpm test, smoke test | node:http built-in only              |
| FR-002      | src/server.ts               | test/server.test.ts   |                                      |
| FR-003      | src/server.ts               | —                     | No automated test yet                |
| FR-004      | src/server.ts               | test/server.test.ts   | POST /v1/render via mjml npm package |
| FR-005      | src/server.ts, src/index.ts | test/server.test.ts   | Bearer token auth, timingSafeEqual   |
| FR-006      | Dockerfile, .dockerignore   | —                     | Proposed                             |
| FR-007      | compose.yaml, README.md     | docker compose config | Healthcheck + restart policy added   |
