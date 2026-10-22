import { createApiServer, type ApiServerOptions } from "./server.ts";
import { EnvConfigError, parseIntEnv, parsePort } from "./env.ts";
import { availableParallelism } from "node:os";
import type { Server } from "node:http";

const MAX_RENDER_WORKERS = Math.max(1, availableParallelism());
const MAX_RENDER_QUEUE_SIZE = 10_000;
const MAX_RENDER_TIMEOUT_MS = 300_000;
const MAX_RATE_LIMIT_WINDOW_MS = 3_600_000;
const MAX_RATE_LIMIT_MAX_REQUESTS = 1_000_000;
const SHUTDOWN_GRACE_MS = 8_000;

function exitWithError(message: string): never {
  process.stderr.write(`Error: ${message}\n`);
  process.exit(1);
}

function readEnvConfig(): { port: number; options: ApiServerOptions } {
  const env = process.env;
  return {
    port: parsePort(env.PORT),
    options: {
      renderWorkerCount: parseIntEnv("RENDER_WORKERS", env.RENDER_WORKERS, 1, MAX_RENDER_WORKERS),
      maxRenderQueueSize: parseIntEnv(
        "RENDER_QUEUE_SIZE",
        env.RENDER_QUEUE_SIZE,
        0,
        MAX_RENDER_QUEUE_SIZE,
      ),
      renderTimeoutMs: parseIntEnv(
        "RENDER_TIMEOUT_MS",
        env.RENDER_TIMEOUT_MS,
        1,
        MAX_RENDER_TIMEOUT_MS,
      ),
      rateLimitMaxRequests: parseIntEnv(
        "RATE_LIMIT_MAX_REQUESTS",
        env.RATE_LIMIT_MAX_REQUESTS,
        1,
        MAX_RATE_LIMIT_MAX_REQUESTS,
      ),
      rateLimitWindowMs: parseIntEnv(
        "RATE_LIMIT_WINDOW_MS",
        env.RATE_LIMIT_WINDOW_MS,
        1,
        MAX_RATE_LIMIT_WINDOW_MS,
      ),
    },
  };
}

const apiKey = process.env.API_KEY;
if (!apiKey) {
  exitWithError("API_KEY environment variable is not set. Server cannot start.");
}

let config: { port: number; options: ApiServerOptions };
try {
  config = readEnvConfig();
} catch (error) {
  if (!(error instanceof EnvConfigError)) throw error;
  exitWithError(error.message);
}

const { port } = config;
const server = createApiServer(apiKey, config.options);

function setupGracefulShutdown(httpServer: Server) {
  let shuttingDown = false;

  const shutdown = (signal: "SIGINT" | "SIGTERM") => {
    if (shuttingDown) return;
    shuttingDown = true;

    process.stderr.write(`Received ${signal}; starting graceful shutdown.\n`);

    const forceExitTimer = setTimeout(() => {
      process.stderr.write(
        `Graceful shutdown exceeded ${SHUTDOWN_GRACE_MS}ms; forcing connection close.\n`,
      );
      httpServer.closeAllConnections?.();
      process.exit(1);
    }, SHUTDOWN_GRACE_MS);
    forceExitTimer.unref();

    httpServer.close((error) => {
      clearTimeout(forceExitTimer);
      if (error) {
        process.stderr.write(`Shutdown error: ${error.message}\n`);
        process.exit(1);
      }
      process.stderr.write("HTTP server stopped cleanly.\n");
      process.exit(0);
    });

    // Immediately drain keep-alive sockets so close callback resolves faster.
    httpServer.closeIdleConnections?.();
  };

  process.once("SIGTERM", () => shutdown("SIGTERM"));
  process.once("SIGINT", () => shutdown("SIGINT"));
}

setupGracefulShutdown(server);

server.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
