/**
 * Validates spec/trace/events/*.md trace event files against the required schema.
 * Usage: node scripts/spec-ledger/validate-trace-events.ts
 */
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

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
const MAX_ERRORS = 20;

function parseFrontmatter(content: string): Record<string, string> | null {
  if (!content.startsWith("---\n")) return null;
  const end = content.indexOf("\n---\n", 4);
  if (end === -1) return null;
  const yaml = content.slice(4, end);
  const fm: Record<string, string> = {};
  for (const line of yaml.split("\n")) {
    const i = line.indexOf(":");
    if (i === -1) continue;
    fm[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return fm;
}

const files = await readdir(DIR);
const eventFiles = files.filter((f) => f.endsWith(".md")).sort();
const errors: string[] = [];

for (const file of eventFiles) {
  const path = join(DIR, file);

  if (!FILENAME_RE.test(file)) {
    errors.push(`${path}: filename must match YYYY-MM-DDTHH-mm-ssZ-<agent>-<req-id>.md`);
    continue;
  }

  const content = await readFile(path, "utf-8");
  const fm = parseFrontmatter(content);
  if (!fm) {
    errors.push(`${path}: missing or malformed YAML frontmatter`);
    continue;
  }

  for (const key of REQUIRED_KEYS) {
    if (!(key in fm)) {
      errors.push(`${path}: missing required frontmatter key "${key}"`);
    }
  }

  if (fm.change_type !== undefined && !VALID_CHANGE_TYPES.has(fm.change_type)) {
    errors.push(
      `${path}: invalid change_type "${fm.change_type}" — must be one of: ${[...VALID_CHANGE_TYPES].join(", ")}`,
    );
  }
}

for (const msg of errors.slice(0, MAX_ERRORS)) {
  console.error(`[ERROR] ${msg}`);
}
if (errors.length > MAX_ERRORS) {
  console.error(`... and ${errors.length - MAX_ERRORS} more error(s)`);
}

if (errors.length > 0) {
  console.error(
    `\nvalidate:trace-events FAILED — ${errors.length} error(s) across ${eventFiles.length} file(s)`,
  );
  process.exit(1);
}
console.log(`validate:trace-events PASSED — ${eventFiles.length} event(s) OK`);
