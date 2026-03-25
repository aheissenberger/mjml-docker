/**
 * Validates that spec/requirements/index.md entries match spec/requirements/*.md files.
 * Usage: node scripts/spec-ledger/validate-req-index.ts
 */
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const DIR = "spec/requirements";
const INDEX_FILE = join(DIR, "index.md");
const FILE_ID_RE = /^[A-Z]+-\d{3}\.md$/;
const VALID_ID_RE = /^[A-Z]+-\d{3}$/;

const [allFiles, indexContent] = await Promise.all([readdir(DIR), readFile(INDEX_FILE, "utf-8")]);

const reqFiles = allFiles.filter((f) => FILE_ID_RE.test(f));
const fileIds = new Set(reqFiles.map((f) => f.replace(".md", "")));

// Extract IDs from markdown table rows: | ID | ... |
const indexIds = new Set<string>();
for (const line of indexContent.split("\n")) {
  const match = /^\|\s*([A-Z]+-\d{3})\s*\|/.exec(line);
  if (match) indexIds.add(match[1]);
}

const errors: string[] = [];

for (const id of fileIds) {
  if (!indexIds.has(id)) {
    errors.push(`${id}: present in spec/requirements/${id}.md but missing from index.md`);
  }
}

for (const id of indexIds) {
  if (!VALID_ID_RE.test(id)) {
    errors.push(`index.md: invalid ID format "${id}"`);
  } else if (!fileIds.has(id)) {
    errors.push(`index.md: entry "${id}" has no matching requirements file`);
  }
}

if (errors.length > 0) {
  for (const msg of errors) console.error(`[ERROR] ${msg}`);
  console.error(`\nvalidate:req-index FAILED — ${errors.length} error(s)`);
  process.exit(1);
}
console.log(`validate:req-index PASSED — ${fileIds.size} requirement(s) indexed OK`);
