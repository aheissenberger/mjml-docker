/**
 * Shared helpers for the spec-ledger validation scripts.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const MAX_ERRORS = 20;

type Frontmatter = Record<string, string>;

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n/;

function parseFrontmatter(content: string): Frontmatter | null {
  const match = FRONTMATTER_RE.exec(content);
  if (!match) return null;
  const fm: Frontmatter = {};
  for (const line of match[1].split("\n")) {
    const i = line.indexOf(":");
    if (i !== -1) fm[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return fm;
}

/**
 * Validates the filename, reads the file and parses its frontmatter.
 * Pushes an error and returns null when the file cannot be validated further.
 */
export async function readSpecFile(
  dir: string,
  file: string,
  filenameRe: RegExp,
  filenamePattern: string,
  errors: string[],
): Promise<{ path: string; content: string; fm: Frontmatter } | null> {
  const path = join(dir, file);

  if (!filenameRe.test(file)) {
    errors.push(`${path}: filename must match ${filenamePattern}`);
    return null;
  }

  const content = await readFile(path, "utf-8");
  const fm = parseFrontmatter(content);
  if (!fm) {
    errors.push(`${path}: missing or malformed YAML frontmatter`);
    return null;
  }
  return { path, content, fm };
}

export function checkRequiredKeys(
  path: string,
  fm: Frontmatter,
  keys: readonly string[],
  errors: string[],
): void {
  for (const key of keys) {
    if (!(key in fm)) {
      errors.push(`${path}: missing required frontmatter key "${key}"`);
    }
  }
}

export function reportResult(
  label: string,
  errors: string[],
  count: number,
  noun: "file" | "event",
): void {
  for (const msg of errors.slice(0, MAX_ERRORS)) {
    console.error(`[ERROR] ${msg}`);
  }
  if (errors.length > MAX_ERRORS) {
    console.error(`... and ${errors.length - MAX_ERRORS} more error(s)`);
  }

  if (errors.length > 0) {
    console.error(`\n${label} FAILED — ${errors.length} error(s) across ${count} file(s)`);
    process.exit(1);
  }
  console.log(`${label} PASSED — ${count} ${noun}(s) OK`);
}
