/**
 * Validates spec/requirements/*.md files against the required schema.
 * Usage: node scripts/spec-ledger/validate-req-files.ts
 */
import { readdir } from "node:fs/promises";

import { checkRequiredKeys, readSpecFile, reportResult } from "./lib.ts";

const DIR = "spec/requirements";
const REQUIRED_KEYS = [
  "id",
  "type",
  "status",
  "owner",
  "depends_on",
  "acceptance_refs",
  "implementation_pointers",
  "parent_req_id",
  "package_scope",
] as const;
const VALID_STATUSES = new Set(["Proposed", "In Progress", "Done"]);
const REQUIRED_SECTIONS = ["## Summary", "## Acceptance Criteria", "## Verification", "## Notes"];
const FILENAME_RE = /^[A-Z]+-\d{3}\.md$/;

const files = await readdir(DIR);
const reqFiles = files.filter((f) => f !== "index.md" && f.endsWith(".md")).sort();
const errors: string[] = [];

for (const file of reqFiles) {
  const spec = await readSpecFile(DIR, file, FILENAME_RE, "<TYPE>-NNN.md", errors);
  if (!spec) continue;
  const { path, content, fm } = spec;

  const expectedId = file.replace(".md", "");
  if (fm.id !== expectedId) {
    errors.push(`${path}: frontmatter id "${fm.id}" does not match filename "${expectedId}"`);
  }

  checkRequiredKeys(path, fm, REQUIRED_KEYS, errors);

  if (fm.status !== undefined && !VALID_STATUSES.has(fm.status)) {
    errors.push(
      `${path}: invalid status "${fm.status}" — must be one of: ${[...VALID_STATUSES].join(", ")}`,
    );
  }

  const bodyStart = content.indexOf("\n---\n") + 5;
  const body = content.slice(bodyStart);
  for (const section of REQUIRED_SECTIONS) {
    if (!body.includes(section)) {
      errors.push(`${path}: missing required section "${section}"`);
    }
  }

  const hasParent = fm.parent_req_id !== undefined && fm.parent_req_id !== "null";
  const hasScope = fm.package_scope !== undefined && fm.package_scope !== "null";
  if (hasParent && !hasScope) {
    errors.push(`${path}: child requirement must have non-null package_scope`);
  }
  if (!hasParent && hasScope) {
    errors.push(`${path}: root requirement must have null package_scope`);
  }
}

reportResult("validate:req-files", errors, reqFiles.length, "file");
