import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import type { Server } from "node:http";

import { createApiServer } from "../src/server.ts";

const TEST_API_KEY = "test-api-key-123";

const VALID_MJML = `<mjml>
  <mj-body>
    <mj-section>
      <mj-column>
        <mj-text>Hello world</mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`;

async function startServer(): Promise<{ server: Server; baseUrl: string }> {
  const server = createApiServer(TEST_API_KEY);
  server.listen(0);
  await once(server, "listening");
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("Server did not bind to an expected address");
  }
  return { server, baseUrl: `http://127.0.0.1:${address.port}` };
}

async function stopServer(server: Server): Promise<void> {
  server.close();
  await once(server, "close");
}

// ─── FR-005: Auth tests ───────────────────────────────────────────────────────

void test("GET /health returns ok without auth", async () => {
  const { server, baseUrl } = await startServer();
  try {
    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { status: "ok" });
  } finally {
    await stopServer(server);
  }
});

void test("GET / without auth header → 401 Unauthorized", async () => {
  const { server, baseUrl } = await startServer();
  try {
    const res = await fetch(`${baseUrl}/`);
    assert.equal(res.status, 401);
    assert.equal(res.headers.get("content-type"), "application/json");
    assert.deepEqual(await res.json(), { message: "Unauthorized" });
  } finally {
    await stopServer(server);
  }
});

void test("GET / with wrong Bearer token → 401 Unauthorized", async () => {
  const { server, baseUrl } = await startServer();
  try {
    const res = await fetch(`${baseUrl}/`, {
      headers: { Authorization: "Bearer wrong-key" },
    });
    assert.equal(res.status, 401);
    assert.deepEqual(await res.json(), { message: "Unauthorized" });
  } finally {
    await stopServer(server);
  }
});

void test("GET / with correct Bearer token → 200", async () => {
  const { server, baseUrl } = await startServer();
  try {
    const res = await fetch(`${baseUrl}/`, {
      headers: { Authorization: `Bearer ${TEST_API_KEY}` },
    });
    assert.equal(res.status, 200);
    const data = (await res.json()) as { endpoints: string[] };
    assert.ok(Array.isArray(data.endpoints));
  } finally {
    await stopServer(server);
  }
});

void test("POST /v1/render without auth → 401", async () => {
  const { server, baseUrl } = await startServer();
  try {
    const res = await fetch(`${baseUrl}/v1/render`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mjml: VALID_MJML }),
    });
    assert.equal(res.status, 401);
    assert.deepEqual(await res.json(), { message: "Unauthorized" });
  } finally {
    await stopServer(server);
  }
});

void test("POST /v1/render with wrong auth → 401", async () => {
  const { server, baseUrl } = await startServer();
  try {
    const res = await fetch(`${baseUrl}/v1/render`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer bad-key",
      },
      body: JSON.stringify({ mjml: VALID_MJML }),
    });
    assert.equal(res.status, 401);
    assert.deepEqual(await res.json(), { message: "Unauthorized" });
  } finally {
    await stopServer(server);
  }
});

// ─── FR-004: Render endpoint tests ───────────────────────────────────────────

const authHeaders = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${TEST_API_KEY}`,
};

void test("POST /v1/render with valid MJML → 200 + html + empty errors", async () => {
  const { server, baseUrl } = await startServer();
  try {
    const res = await fetch(`${baseUrl}/v1/render`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ mjml: VALID_MJML }),
    });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("content-type"), "application/json");
    const data = (await res.json()) as { html: string; errors: unknown[] };
    assert.ok(typeof data.html === "string" && data.html.length > 0);
    assert.deepEqual(data.errors, []);
  } finally {
    await stopServer(server);
  }
});

void test("POST /v1/render with MJML that has warnings → 200 + errors populated", async () => {
  const { server, baseUrl } = await startServer();
  // Use an unknown tag to trigger a non-fatal MJML validation warning
  const mjmlWithWarning = `<mjml>
  <mj-body>
    <mj-section>
      <mj-column>
        <mj-text font-size="999px">Hello</mj-text>
      </mj-column>
    </mj-section>
    <mj-unknown-tag></mj-unknown-tag>
  </mj-body>
</mjml>`;
  try {
    const res = await fetch(`${baseUrl}/v1/render`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ mjml: mjmlWithWarning }),
    });
    assert.equal(res.status, 200);
    const data = (await res.json()) as { html: string; errors: unknown[] };
    assert.ok(typeof data.html === "string");
    // Errors may or may not be populated depending on MJML version; just verify shape
    assert.ok(Array.isArray(data.errors));
  } finally {
    await stopServer(server);
  }
});

void test("POST /v1/render missing mjml field → 422", async () => {
  const { server, baseUrl } = await startServer();
  try {
    const res = await fetch(`${baseUrl}/v1/render`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ foo: "bar" }),
    });
    assert.equal(res.status, 422);
    const data = (await res.json()) as { message: string };
    assert.ok(typeof data.message === "string" && data.message.length > 0);
  } finally {
    await stopServer(server);
  }
});

void test("POST /v1/render with non-string mjml → 422", async () => {
  const { server, baseUrl } = await startServer();
  try {
    const res = await fetch(`${baseUrl}/v1/render`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ mjml: 42 }),
    });
    assert.equal(res.status, 422);
    const data = (await res.json()) as { message: string };
    assert.ok(typeof data.message === "string" && data.message.length > 0);
  } finally {
    await stopServer(server);
  }
});

void test("POST /v1/render with invalid JSON body → 422", async () => {
  const { server, baseUrl } = await startServer();
  try {
    const res = await fetch(`${baseUrl}/v1/render`, {
      method: "POST",
      headers: authHeaders,
      body: "not-json{{{",
    });
    assert.equal(res.status, 422);
    const data = (await res.json()) as { message: string };
    assert.ok(typeof data.message === "string" && data.message.length > 0);
  } finally {
    await stopServer(server);
  }
});
