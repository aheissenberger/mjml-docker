# Requirement Index

Generated file. Do not edit manually.  
Source of truth: `spec/requirements/*.md`

| ID     | Status | Summary                                                                                           |
| ------ | ------ | ------------------------------------------------------------------------------------------------- |
| FR-001 | Done   | HTTP API server foundation — listens on configurable port                                         |
| FR-002 | Done   | Health check endpoint — GET /health returns { status: ok }                                        |
| FR-003 | Done   | Root info endpoint — GET / returns server info and endpoint list                                  |
| FR-004 | Done   | MJML render endpoint — POST /v1/render accepts MJML template, returns HTML                        |
| FR-005 | Done   | API key authentication — Bearer token via API_KEY env var                                         |
| FR-006 | Done   | Dockerfile — multi-stage build, node:25-trixie-slim, non-root runtime                             |
| FR-007 | Done   | Docker Compose file — service health check and restart policy                                     |
| FR-008 | Done   | Request-scoped MJML options — optional constrained `options` object with `minify` post-processing |
