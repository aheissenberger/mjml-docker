/**
 * Validates spec/trace/events/*.md trace event files against the required schema.
 * Usage: node scripts/spec-ledger/validate-trace-events.ts
 */
import { readdir } from "node:fs/promises";

import { checkRequiredKeys, readSpecFile, reportResult } from "./lib.ts";

const DIR = "spec/trace/events";
const REQUIRED_KEYS = [
  "req_id",
  "change_type",
  "files",
  "tests",
  "docs",
  "pr",
  "commit",
  "author",
  "timestamp",
] as const;
const VALID_CHANGE_TYPES = new Set([
  "propose",
  "implement",
  "verify",
  "decision",
  "status-update",
  "claim",
]);
// YYYY-MM-DDTHH-mm-ssZ-<agent>-<req-id>.md
const FILENAME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z-.+-.+\.md$/;

const files = await readdir(DIR);
const eventFiles = files.filter((f) => f.endsWith(".md")).sort();
const errors: string[] = [];

for (const file of eventFiles) {
  const spec = await readSpecFile(
    DIR,
    file,
    FILENAME_RE,
    "YYYY-MM-DDTHH-mm-ssZ-<agent>-<req-id>.md",
    errors,
  );
  if (!spec) continue;
  const { path, fm } = spec;

  checkRequiredKeys(path, fm, REQUIRED_KEYS, errors);

  if (fm.change_type !== undefined && !VALID_CHANGE_TYPES.has(fm.change_type)) {
    errors.push(
      `${path}: invalid change_type "${fm.change_type}" — must be one of: ${[...VALID_CHANGE_TYPES].join(", ")}`,
    );
  }
}

reportResult("validate:trace-events", errors, eventFiles.length, "event");
