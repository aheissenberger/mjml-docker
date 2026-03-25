import { createApiServer } from "./server.ts";
import { availableParallelism } from "node:os";

const MAX_RENDER_WORKERS = Math.max(1, availableParallelism());
const MAX_RENDER_QUEUE_SIZE = 10_000;
const MAX_RENDER_TIMEOUT_MS = 300_000;
const MAX_RATE_LIMIT_WINDOW_MS = 3_600_000;
const MAX_RATE_LIMIT_MAX_REQUESTS = 1_000_000;

function resolvePort(value: string | undefined): number {
  if (value === undefined) return 3000;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65_535) {
    process.stderr.write(`Error: PORT must be an integer between 1 and 65535, got "${value}".\n`);
    process.exit(1);
  }
  return parsed;
}

function resolvePositiveIntEnv(
  name: string,
  value: string | undefined,
  allowZero = false,
  maxValue?: number,
): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number.parseInt(value, 10);
  const min = allowZero ? 0 : 1;

  if (!Number.isInteger(parsed) || parsed < min) {
    const rangeText = allowZero ? "an integer >= 0" : "an integer >= 1";
    process.stderr.write(`Error: ${name} must be ${rangeText}, got "${value}".\n`);
    process.exit(1);
  }

  if (maxValue !== undefined && parsed > maxValue) {
    process.stderr.write(`Error: ${name} must be <= ${maxValue}, got "${value}".\n`);
    process.exit(1);
  }

  return parsed;
}

const apiKey = process.env.API_KEY;
if (!apiKey) {
  process.stderr.write("Error: API_KEY environment variable is not set. Server cannot start.\n");
  process.exit(1);
}

const port = resolvePort(process.env.PORT);
const server = createApiServer(apiKey, {
  renderWorkerCount: resolvePositiveIntEnv(
    "RENDER_WORKERS",
    process.env.RENDER_WORKERS,
    false,
    MAX_RENDER_WORKERS,
  ),
  maxRenderQueueSize: resolvePositiveIntEnv(
    "RENDER_QUEUE_SIZE",
    process.env.RENDER_QUEUE_SIZE,
    true,
    MAX_RENDER_QUEUE_SIZE,
  ),
  renderTimeoutMs: resolvePositiveIntEnv(
    "RENDER_TIMEOUT_MS",
    process.env.RENDER_TIMEOUT_MS,
    false,
    MAX_RENDER_TIMEOUT_MS,
  ),
  rateLimitMaxRequests: resolvePositiveIntEnv(
    "RATE_LIMIT_MAX_REQUESTS",
    process.env.RATE_LIMIT_MAX_REQUESTS,
    false,
    MAX_RATE_LIMIT_MAX_REQUESTS,
  ),
  rateLimitWindowMs: resolvePositiveIntEnv(
    "RATE_LIMIT_WINDOW_MS",
    process.env.RATE_LIMIT_WINDOW_MS,
    false,
    MAX_RATE_LIMIT_WINDOW_MS,
  ),
});

server.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
