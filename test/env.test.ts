import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { EnvConfigError, parseIntEnv, parsePort, readApiKey } from "../src/env.ts";

// ─── FR-005: API key source ───────────────────────────────────────────────────

void test("readApiKey returns API_KEY when no file is set", () => {
  assert.equal(readApiKey("env-key", undefined), "env-key");
  assert.equal(readApiKey("env-key", ""), "env-key");
});

void test("readApiKey returns undefined when no key is set", () => {
  assert.equal(readApiKey(undefined, undefined), undefined);
  assert.equal(readApiKey("", ""), undefined);
});

void test("readApiKey prefers the trimmed file content over API_KEY", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "mjml-api-key-"));
  t.after(() => rmSync(dir, { recursive: true }));
  const file = join(dir, "api_key");
  writeFileSync(file, "file-key\n");
  assert.equal(readApiKey("env-key", file), "file-key");
});

void test("readApiKey rejects a missing file without exposing a key", () => {
  assert.throws(() => readApiKey("env-key", "/does/not/exist"), {
    message: 'API_KEY_FILE could not be read: "/does/not/exist".',
  });
});

void test("readApiKey rejects an empty file", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "mjml-api-key-"));
  t.after(() => rmSync(dir, { recursive: true }));
  const file = join(dir, "api_key");
  writeFileSync(file, " \n");
  assert.throws(() => readApiKey("env-key", file), EnvConfigError);
});

// ─── FR-001: Startup env validation ───────────────────────────────────────────

void test("parsePort defaults to 3000 when unset", () => {
  assert.equal(parsePort(undefined), 3000);
});

void test("parsePort accepts values within 1..65535", () => {
  assert.equal(parsePort("1"), 1);
  assert.equal(parsePort("8080"), 8080);
  assert.equal(parsePort("65535"), 65_535);
});

void test("parsePort rejects out-of-range and non-numeric values", () => {
  for (const value of ["0", "65536", "-1", "abc", ""]) {
    assert.throws(() => parsePort(value), {
      name: "Error",
      message: `PORT must be an integer between 1 and 65535, got "${value}".`,
    });
  }
});

void test("parseIntEnv returns undefined when unset", () => {
  assert.equal(parseIntEnv("RENDER_WORKERS", undefined, 1, 4), undefined);
});

void test("parseIntEnv accepts values within bounds", () => {
  assert.equal(parseIntEnv("RENDER_WORKERS", "4", 1, 4), 4);
  assert.equal(parseIntEnv("RENDER_QUEUE_SIZE", "0", 0, 10), 0);
});

void test("parseIntEnv rejects values below the minimum", () => {
  assert.throws(() => parseIntEnv("RENDER_WORKERS", "0", 1, 4), {
    message: 'RENDER_WORKERS must be an integer >= 1, got "0".',
  });
  assert.throws(() => parseIntEnv("RENDER_QUEUE_SIZE", "-1", 0, 10), {
    message: 'RENDER_QUEUE_SIZE must be an integer >= 0, got "-1".',
  });
  assert.throws(() => parseIntEnv("RENDER_WORKERS", "many", 1, 4), EnvConfigError);
});

void test("parseIntEnv rejects values above the maximum", () => {
  assert.throws(() => parseIntEnv("RENDER_WORKERS", "5", 1, 4), {
    message: 'RENDER_WORKERS must be <= 4, got "5".',
  });
});
