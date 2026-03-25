import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";

import { createApiServer } from "../src/server.ts";

void test("GET /health returns ok", async () => {
  const server = createApiServer();
  server.listen(0);
  await once(server, "listening");

  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("Server did not bind to an expected address");
  }

  const response = await fetch(`http://127.0.0.1:${address.port}/health`);
  const data = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(data, { status: "ok" });

  server.close();
  await once(server, "close");
});
