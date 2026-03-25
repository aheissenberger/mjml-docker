#!/usr/bin/env bash
set -euo pipefail

# Run formatter and lints for changed files when an agent session stops.

if ! command -v git >/dev/null 2>&1; then
  echo "[hook] git not found; skipping lint/format"
  exit 0
fi

if ! command -v pnpm >/dev/null 2>&1; then
  echo "[hook] pnpm not found; skipping lint/format"
  exit 0
fi

# Collect staged, unstaged, and untracked files.
changed_files=()
while IFS= read -r path; do
  changed_files+=("$path")
done < <(
  {
    git diff --name-only --diff-filter=ACMRTUXB
    git diff --cached --name-only --diff-filter=ACMRTUXB
    git ls-files --others --exclude-standard
  } | awk 'NF' | sort -u
)

if [[ ${#changed_files[@]} -eq 0 ]]; then
  echo "[hook] no changed files; nothing to lint/format"
  exit 0
fi

supported_files=()
skipped_files=()

for path in "${changed_files[@]}"; do
  if [[ ! -f "$path" ]]; then
    continue
  fi

  case "$path" in
    *.js|*.mjs|*.cjs|*.jsx|*.ts|*.mts|*.cts|*.tsx|*.json)
      supported_files+=("$path")
      ;;
    *)
      skipped_files+=("$path")
      ;;
  esac

done

if [[ ${#supported_files[@]} -gt 0 ]]; then
  echo "[hook] formatting ${#supported_files[@]} changed file(s)"
  pnpm exec oxfmt --write "${supported_files[@]}"

  echo "[hook] linting ${#supported_files[@]} changed file(s)"
  pnpm exec oxlint "${supported_files[@]}"

  # Run type-aware lint only when at least one TypeScript file changed.
  ts_files=()
  for path in "${supported_files[@]}"; do
    case "$path" in
      *.ts|*.mts|*.cts|*.tsx)
        ts_files+=("$path")
        ;;
    esac
  done

  if [[ ${#ts_files[@]} -gt 0 ]]; then
    echo "[hook] running type-aware lint for ${#ts_files[@]} TypeScript file(s)"
    pnpm exec oxlint --type-aware --type-check "${ts_files[@]}"
  fi
else
  echo "[hook] changed files are not lint/format targets"
fi

if [[ ${#skipped_files[@]} -gt 0 ]]; then
  echo "[hook] skipped unsupported changed file(s):"
  printf '  - %s\n' "${skipped_files[@]}"
fi

echo "[hook] lint/format on changed files complete"
