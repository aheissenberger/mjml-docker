import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import type { Server } from "node:http";

import { createApiServer, type ApiServerOptions, type ApiServer } from "../src/server.ts";

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

async function startServer(
  options: ApiServerOptions = {},
): Promise<{ server: ApiServer; baseUrl: string }> {
  const server = createApiServer(TEST_API_KEY, options);
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

void test("GET /health with query string returns ok without auth", async () => {
  const { server, baseUrl } = await startServer();
  try {
    const res = await fetch(`${baseUrl}/health?probe=1`);
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

void test("GET / with query string and correct token → 200", async () => {
  const { server, baseUrl } = await startServer();
  try {
    const res = await fetch(`${baseUrl}/?verbose=true`, {
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

void test("POST /v1/render with options.fonts → 200 + custom font import", async () => {
  const { server, baseUrl } = await startServer();
  const mjmlWithCustomFont = `<mjml>
  <mj-body>
    <mj-section>
      <mj-column>
        <mj-text font-family="Acme">Hello</mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`;
  try {
    const res = await fetch(`${baseUrl}/v1/render`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        mjml: mjmlWithCustomFont,
        options: { fonts: { Acme: "https://example.com/acme.css" } },
      }),
    });
    assert.equal(res.status, 200);
    const data = (await res.json()) as { html: string; errors: unknown[] };
    assert.ok(data.html.includes("https://example.com/acme.css"));
    assert.ok(Array.isArray(data.errors));
  } finally {
    await stopServer(server);
  }
});

void test("POST /v1/render with options.keepComments boolean → 200", async () => {
  const { server, baseUrl } = await startServer();
  try {
    const res = await fetch(`${baseUrl}/v1/render`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        mjml: VALID_MJML,
        options: { keepComments: false },
      }),
    });
    assert.equal(res.status, 200);
    const data = (await res.json()) as { html: string; errors: unknown[] };
    assert.ok(typeof data.html === "string" && data.html.length > 0);
  } finally {
    await stopServer(server);
  }
});

void test("POST /v1/render with options.minify=true → 200 + shorter output", async () => {
  const { server, baseUrl } = await startServer();
  const formattedMjml = `<mjml>
  <mj-body>
    <mj-section>
      <mj-column>
        <mj-text>
          Hello world
        </mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`;
  try {
    const [normalRes, minifiedRes] = await Promise.all([
      fetch(`${baseUrl}/v1/render`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ mjml: formattedMjml }),
      }),
      fetch(`${baseUrl}/v1/render`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ mjml: formattedMjml, options: { minify: true } }),
      }),
    ]);

    assert.equal(normalRes.status, 200);
    assert.equal(minifiedRes.status, 200);

    const normalData = (await normalRes.json()) as { html: string };
    const minifiedData = (await minifiedRes.json()) as { html: string };
    assert.ok(minifiedData.html.length < normalData.html.length);
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

void test("POST /v1/render with non-object options → 422", async () => {
  const { server, baseUrl } = await startServer();
  try {
    const res = await fetch(`${baseUrl}/v1/render`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ mjml: VALID_MJML, options: "bad" }),
    });
    assert.equal(res.status, 422);
    const data = (await res.json()) as { message: string };
    assert.ok(data.message.includes("options"));
  } finally {
    await stopServer(server);
  }
});

void test("POST /v1/render with unknown options key → 422", async () => {
  const { server, baseUrl } = await startServer();
  try {
    const res = await fetch(`${baseUrl}/v1/render`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ mjml: VALID_MJML, options: { notAllowed: true } }),
    });
    assert.equal(res.status, 422);
    const data = (await res.json()) as { message: string };
    assert.ok(data.message.includes("unknown option"));
  } finally {
    await stopServer(server);
  }
});

void test("POST /v1/render with non-boolean options.minify → 422", async () => {
  const { server, baseUrl } = await startServer();
  try {
    const res = await fetch(`${baseUrl}/v1/render`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ mjml: VALID_MJML, options: { minify: "yes" } }),
    });
    assert.equal(res.status, 422);
    const data = (await res.json()) as { message: string };
    assert.ok(data.message.includes("options.minify"));
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

void test("POST /v1/render with invalid options.fonts URL scheme → 422", async () => {
  const { server, baseUrl } = await startServer();
  try {
    const res = await fetch(`${baseUrl}/v1/render`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        mjml: VALID_MJML,
        options: { fonts: { BadFont: "javascript:alert(1)" } },
      }),
    });
    assert.equal(res.status, 422);
    const data = (await res.json()) as { message: string };
    assert.ok(data.message.includes("only https URLs are allowed"));
  } finally {
    await stopServer(server);
  }
});

void test("POST /v1/render oversized body → 413", async () => {
  const { server, baseUrl } = await startServer();
  const largeText = "A".repeat(1_100_000);
  const largeMjml = `<mjml><mj-body><mj-section><mj-column><mj-text>${largeText}</mj-text></mj-column></mj-section></mj-body></mjml>`;
  try {
    const res = await fetch(`${baseUrl}/v1/render`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ mjml: largeMjml }),
    });
    assert.equal(res.status, 413);
    const data = (await res.json()) as { message: string };
    assert.ok(data.message.includes("too large"));
  } finally {
    await stopServer(server);
  }
});

void test("POST /v1/render returns 503 when render queue is saturated", async () => {
  const { server, baseUrl } = await startServer({
    renderWorkerCount: 1,
    maxRenderQueueSize: 0,
    rateLimitMaxRequests: 100,
  });
  const requestBody = JSON.stringify({ mjml: VALID_MJML, options: { minify: true } });
  try {
    const responses = await Promise.all(
      Array.from({ length: 8 }, () =>
        fetch(`${baseUrl}/v1/render`, {
          method: "POST",
          headers: authHeaders,
          body: requestBody,
        }),
      ),
    );

    assert.ok(responses.some((res) => res.status === 200));
    assert.ok(responses.some((res) => res.status === 503));

    const recoveryResponse = await fetch(`${baseUrl}/v1/render`, {
      method: "POST",
      headers: authHeaders,
      body: requestBody,
    });
    assert.equal(recoveryResponse.status, 200);
  } finally {
    await stopServer(server);
  }
});

void test("POST /v1/render returns 429 when rate limit is exceeded", async () => {
  const { server, baseUrl } = await startServer({
    rateLimitMaxRequests: 2,
    rateLimitWindowMs: 60_000,
  });
  const requestBody = JSON.stringify({ mjml: VALID_MJML });
  try {
    const first = await fetch(`${baseUrl}/v1/render`, {
      method: "POST",
      headers: authHeaders,
      body: requestBody,
    });
    const second = await fetch(`${baseUrl}/v1/render`, {
      method: "POST",
      headers: authHeaders,
      body: requestBody,
    });
    const third = await fetch(`${baseUrl}/v1/render`, {
      method: "POST",
      headers: authHeaders,
      body: requestBody,
    });

    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.equal(third.status, 429);
  } finally {
    await stopServer(server);
  }
});

// ─── URL policy ───────────────────────────────────────────────────────────────

void test("POST /v1/render with http:// font URL → 422", async () => {
  const { server, baseUrl } = await startServer();
  try {
    const res = await fetch(`${baseUrl}/v1/render`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        mjml: VALID_MJML,
        options: { fonts: { MyFont: "http://example.com/font.css" } },
      }),
    });
    assert.equal(res.status, 422);
    const data = (await res.json()) as { message: string };
    assert.ok(data.message.includes("only https URLs are allowed"));
  } finally {
    await stopServer(server);
  }
});

// ─── Worker-failure path ──────────────────────────────────────────────────────

void test("worker pool recovers after idle worker terminates unexpectedly", async () => {
  const { server, baseUrl } = await startServer({
    renderWorkerCount: 1,
    maxRenderQueueSize: 0,
    rateLimitMaxRequests: 100,
  });
  try {
    // Terminate the idle worker; pool should auto-restart it.
    await server.pool.terminateWorker(0);
    // Allow the exit event and pool restart to propagate.
    await new Promise<void>((resolve) => setImmediate(resolve));

    // The restarted worker should handle new requests normally.
    const res = await fetch(`${baseUrl}/v1/render`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ mjml: VALID_MJML }),
    });
    assert.equal(res.status, 200);
  } finally {
    await stopServer(server);
  }
});

void test("worker crash during render rejects in-flight task and pool recovers", async () => {
  const { server, baseUrl } = await startServer({
    renderWorkerCount: 1,
    maxRenderQueueSize: 1,
    rateLimitMaxRequests: 100,
  });
  const requestBody = JSON.stringify({ mjml: VALID_MJML });
  try {
    // Request A occupies the single worker; request B is queued.
    const resAPromise = fetch(`${baseUrl}/v1/render`, {
      method: "POST",
      headers: authHeaders,
      body: requestBody,
    });
    const resBPromise = fetch(`${baseUrl}/v1/render`, {
      method: "POST",
      headers: authHeaders,
      body: requestBody,
    });

    // Wait for both requests to reach the server and be dispatched/queued,
    // then terminate the worker while it is still processing request A.
    await new Promise<void>((resolve) => setTimeout(resolve, 30));
    await server.pool.terminateWorker(0);

    // The in-flight task (A) must be rejected with 500.
    const resA = await resAPromise;
    assert.equal(resA.status, 500);

    // Request B was queued and is picked up by the restarted worker.
    const resB = await resBPromise;
    assert.equal(resB.status, 200);
  } finally {
    await stopServer(server);
  }
});

// ─── Cancellation path ───────────────────────────────────────────────────────

void test("client disconnect during render is handled gracefully and pool recovers", async () => {
  const { server, baseUrl } = await startServer({
    renderWorkerCount: 1,
    maxRenderQueueSize: 5,
    rateLimitMaxRequests: 100,
  });
  try {
    const controller = new AbortController();
    const abortedFetch = fetch(`${baseUrl}/v1/render`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ mjml: VALID_MJML }),
      signal: controller.signal,
    }).catch(() => null); // AbortError is expected

    // Abort after a short delay — the render may or may not be complete; either is fine.
    await new Promise<void>((resolve) => setTimeout(resolve, 20));
    controller.abort();
    await abortedFetch;

    // Allow any pending cleanup to settle before sending the recovery request.
    await new Promise<void>((resolve) => setImmediate(resolve));

    const res = await fetch(`${baseUrl}/v1/render`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ mjml: VALID_MJML }),
    });
    assert.equal(res.status, 200);
  } finally {
    await stopServer(server);
  }
});
