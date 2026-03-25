/**
 * Validates spec/requirements/*.md files against the required schema.
 * Usage: node scripts/spec-ledger/validate-req-files.ts
 */
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

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
const reqFiles = files.filter((f) => f !== "index.md" && f.endsWith(".md")).sort();
const errors: string[] = [];

for (const file of reqFiles) {
    const path = join(DIR, file);

    if (!FILENAME_RE.test(file)) {
        errors.push(`${path}: filename must match <TYPE>-NNN.md`);
        continue;
    }

    const content = await readFile(path, "utf-8");
    const fm = parseFrontmatter(content);
    if (!fm) {
        errors.push(`${path}: missing or malformed YAML frontmatter`);
        continue;
    }

    const expectedId = file.replace(".md", "");
    if (fm.id !== expectedId) {
        errors.push(`${path}: frontmatter id "${fm.id}" does not match filename "${expectedId}"`);
    }

    for (const key of REQUIRED_KEYS) {
        if (!(key in fm)) {
            errors.push(`${path}: missing required frontmatter key "${key}"`);
        }
    }

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

for (const msg of errors.slice(0, MAX_ERRORS)) {
    console.error(`[ERROR] ${msg}`);
}
if (errors.length > MAX_ERRORS) {
    console.error(`... and ${errors.length - MAX_ERRORS} more error(s)`);
}

if (errors.length > 0) {
    console.error(
        `\nvalidate:req-files FAILED — ${errors.length} error(s) across ${reqFiles.length} file(s)`,
    );
    process.exit(1);
}
console.log(`validate:req-files PASSED — ${reqFiles.length} file(s) OK`);
