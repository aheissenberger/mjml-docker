#!/usr/bin/env bash
set -euo pipefail

# Run spec validation when spec files changed in this session.

if ! command -v git >/dev/null 2>&1; then
  echo "[hook] git not found; skipping spec verification"
  exit 0
fi

if ! command -v pnpm >/dev/null 2>&1; then
  echo "[hook] pnpm not found; skipping spec verification"
  exit 0
fi

spec_changed_count=$(
  {
    git diff --name-only --diff-filter=ACMRTUXB
    git diff --cached --name-only --diff-filter=ACMRTUXB
    git ls-files --others --exclude-standard
  } | awk '/^spec\// { count += 1 } END { print count + 0 }'
)

if [[ "$spec_changed_count" -eq 0 ]]; then
  echo "[hook] no spec file changes; skipping spec verification"
  exit 0
fi

echo "[hook] detected ${spec_changed_count} spec file change(s); running spec validation"
pnpm spec:validate

echo "[hook] spec verification complete"
