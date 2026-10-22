import { test } from "node:test";
import assert from "node:assert/strict";

import { EnvConfigError, parseIntEnv, parsePort } from "../src/env.ts";

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
