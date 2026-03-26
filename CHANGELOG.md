# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog, and this project follows Semantic Versioning.

## [Unreleased]

## [1.1.0] - 2026-03-26

### Added

- Runtime graceful shutdown handling on `SIGTERM` and `SIGINT`.
- Developer stop-hook automation for lint/format and spec verification workflows.

### Changed

- API/runtime behavior: added request cancellation support, rate limiting, and bounded runtime configuration for rendering.
- Operations and API docs expanded with environment presets, compose usage flow, and documented API limits.
- Continuous integration GitHub Actions dependency versions were updated via Dependabot.

### Fixed

- Docker Compose healthcheck now uses the configured `PORT` consistently.
- Traceability Matrix formatting corrections for ledger consistency.

[Unreleased]: https://github.com/aheissenberger/mjml-docker/compare/1.1.0...HEAD
[1.1.0]: https://github.com/aheissenberger/mjml-docker/releases/tag/1.1.0
