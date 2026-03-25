import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { availableParallelism } from "node:os";
import { Worker } from "node:worker_threads";

const UNAUTHORIZED = JSON.stringify({ message: "Unauthorized" });
const JSON_CT = { "content-type": "application/json" };
const ALLOWED_RENDER_OPTIONS = new Set(["fonts", "keepComments", "minify"]);
const MAX_RENDER_BODY_BYTES = 1024 * 1024;
const BODY_READ_TIMEOUT_MS = 10_000;
const RENDER_TIMEOUT_MS = 20_000;
const DEFAULT_RENDER_QUEUE_SIZE = 64;
const DEFAULT_RENDER_WORKER_COUNT = Math.max(1, Math.min(4, availableParallelism() - 1));
const DEFAULT_RATE_LIMIT_MAX_REQUESTS = 120;
const DEFAULT_RATE_LIMIT_WINDOW_MS = 60_000;

type RenderWorkerRequest = {
  taskId: number;
  mjmlInput: string;
  options: RenderOptions;
};

type RenderWorkerErrorResponse = {
  taskId: number;
  ok: false;
  message: string;
  statusCode: number;
};

type RenderWorkerSuccessResponse = {
  taskId: number;
  ok: true;
  html: string;
  errors: Array<{ tagName: string; message: string; line: number }>;
};

type RenderWorkerResponse = RenderWorkerErrorResponse | RenderWorkerSuccessResponse;

type PendingRenderTask = {
  resolve: (value: {
    html: string;
    errors: Array<{ tagName: string; message: string; line: number }>;
  }) => void;
  reject: (error: unknown) => void;
  timeout: NodeJS.Timeout;
  signal?: AbortSignal;
  onAbort?: () => void;
};

type WorkerSlot = {
  worker: Worker;
  runningTaskId: number | null;
};

export type ApiServerOptions = {
  renderWorkerCount?: number;
  maxRenderQueueSize?: number;
  renderTimeoutMs?: number;
  rateLimitMaxRequests?: number;
  rateLimitWindowMs?: number;
};

class BodyReadError extends Error {
  readonly code: "BODY_TOO_LARGE" | "BODY_TIMEOUT" | "BODY_ABORTED" | "BODY_READ_FAILED";

  constructor(
    code: "BODY_TOO_LARGE" | "BODY_TIMEOUT" | "BODY_ABORTED" | "BODY_READ_FAILED",
    message: string,
  ) {
    super(message);
    this.code = code;
  }
}

class RenderExecutionError extends Error {
  readonly statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

class SlidingWindowRateLimiter {
  private buckets = new Map<string, { count: number; windowStart: number }>();
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(options: ApiServerOptions = {}) {
    this.maxRequests = resolveStrictPositiveInt(
      options.rateLimitMaxRequests,
      DEFAULT_RATE_LIMIT_MAX_REQUESTS,
      "rateLimitMaxRequests",
    );
    this.windowMs = resolveStrictPositiveInt(
      options.rateLimitWindowMs,
      DEFAULT_RATE_LIMIT_WINDOW_MS,
      "rateLimitWindowMs",
    );
  }

  allow(key: string, now = Date.now()): boolean {
    const bucket = this.buckets.get(key);
    if (!bucket || now - bucket.windowStart >= this.windowMs) {
      this.buckets.set(key, { count: 1, windowStart: now });
      return true;
    }

    if (bucket.count >= this.maxRequests) {
      return false;
    }

    bucket.count += 1;
    return true;
  }
}

function resolveStrictPositiveInt(
  value: number | undefined,
  fallback: number,
  fieldName: string,
  zeroAllowed = false,
): number {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || value < 0) {
    throw new TypeError(
      `${fieldName} must be ${zeroAllowed ? "an integer >= 0" : "an integer >= 1"}`,
    );
  }
  if (!zeroAllowed && value === 0) {
    throw new TypeError(`${fieldName} must be an integer >= 1`);
  }
  return value;
}

class RenderWorkerPool {
  private workers: WorkerSlot[] = [];
  private queue: RenderWorkerRequest[] = [];
  private nextTaskId = 1;
  private pending = new Map<number, PendingRenderTask>();
  private closed = false;
  private readonly workerCount: number;
  private readonly maxQueueSize: number;
  private readonly renderTimeoutMs: number;

  constructor(options: ApiServerOptions = {}) {
    this.workerCount = resolveStrictPositiveInt(
      options.renderWorkerCount,
      DEFAULT_RENDER_WORKER_COUNT,
      "renderWorkerCount",
    );
    this.maxQueueSize = resolveStrictPositiveInt(
      options.maxRenderQueueSize,
      DEFAULT_RENDER_QUEUE_SIZE,
      "maxRenderQueueSize",
      true,
    );
    this.renderTimeoutMs = resolveStrictPositiveInt(
      options.renderTimeoutMs,
      RENDER_TIMEOUT_MS,
      "renderTimeoutMs",
    );

    for (let index = 0; index < this.workerCount; index++) {
      this.workers.push(this.createWorkerSlot(index));
    }
  }

  async render(
    mjmlInput: string,
    options: RenderOptions,
    signal?: AbortSignal,
  ): Promise<{ html: string; errors: Array<{ tagName: string; message: string; line: number }> }> {
    if (this.closed) {
      throw new RenderExecutionError(500, "Render worker is closed");
    }

    const totalCapacity = this.workerCount + this.maxQueueSize;
    if (this.pending.size >= totalCapacity) {
      throw new RenderExecutionError(503, "Render queue is full; please retry later");
    }

    const taskId = this.nextTaskId++;
    return new Promise((resolve, reject) => {
      if (signal?.aborted) {
        reject(new RenderExecutionError(499, "Request cancelled by client"));
        return;
      }

      const timeout = setTimeout(() => {
        const pending = this.pending.get(taskId);
        if (pending) {
          this.pending.delete(taskId);
          this.cleanupPendingTask(pending);
        }
        const queueIndex = this.queue.findIndex((task) => task.taskId === taskId);
        if (queueIndex >= 0) this.queue.splice(queueIndex, 1);
        reject(new RenderExecutionError(503, "Rendering timed out"));
      }, this.renderTimeoutMs);

      const pending: PendingRenderTask = { resolve, reject, timeout };
      if (signal) {
        const onAbort = () => {
          this.cancelTask(taskId, new RenderExecutionError(499, "Request cancelled by client"));
        };
        signal.addEventListener("abort", onAbort, { once: true });
        pending.signal = signal;
        pending.onAbort = onAbort;
      }

      this.pending.set(taskId, pending);
      this.queue.push({ taskId, mjmlInput, options } satisfies RenderWorkerRequest);
      this.dispatch();
    });
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    for (const [, pending] of this.pending) {
      clearTimeout(pending.timeout);
      this.cleanupPendingTask(pending);
      pending.reject(new RenderExecutionError(500, "Render worker closed before completing task"));
    }
    this.pending.clear();
    this.queue = [];
    await Promise.all(this.workers.map((slot) => slot.worker.terminate()));
    this.workers = [];
  }

  private createWorkerSlot(index: number): WorkerSlot {
    const worker = new Worker(new URL("./render-worker.ts", import.meta.url));
    const slot: WorkerSlot = { worker, runningTaskId: null };

    worker.on("message", (message: RenderWorkerResponse) => {
      this.workers[index].runningTaskId = null;
      const pending = this.pending.get(message.taskId);
      if (!pending) {
        this.dispatch();
        return;
      }
      this.pending.delete(message.taskId);
      clearTimeout(pending.timeout);
      this.cleanupPendingTask(pending);

      if (message.ok) {
        pending.resolve({ html: message.html, errors: message.errors });
        this.dispatch();
        return;
      }

      pending.reject(new RenderExecutionError(message.statusCode, message.message));
      this.dispatch();
    });

    worker.on("error", (error) => {
      const message = error instanceof Error ? error.message : "Unknown render worker error";
      this.handleWorkerFailure(
        index,
        new RenderExecutionError(500, `Render worker error: ${message}`),
      );
    });

    worker.on("exit", (code) => {
      if (this.closed) return;
      this.handleWorkerFailure(
        index,
        new RenderExecutionError(500, `Render worker exited unexpectedly with code ${code}`),
      );
    });

    return slot;
  }

  private handleWorkerFailure(index: number, error: RenderExecutionError) {
    const runningTaskId = this.workers[index]?.runningTaskId;
    if (runningTaskId !== null && runningTaskId !== undefined) {
      const pending = this.pending.get(runningTaskId);
      if (pending) {
        this.pending.delete(runningTaskId);
        clearTimeout(pending.timeout);
        this.cleanupPendingTask(pending);
        pending.reject(error);
      }
    }

    if (this.closed) return;
    this.workers[index] = this.createWorkerSlot(index);
    this.dispatch();
  }

  private dispatch() {
    if (this.closed) return;

    for (let index = 0; index < this.workers.length; index++) {
      const slot = this.workers[index];
      if (slot.runningTaskId !== null) continue;

      const nextTask = this.queue.shift();
      if (!nextTask) return;

      const pending = this.pending.get(nextTask.taskId);
      if (!pending) {
        index -= 1;
        continue;
      }

      slot.runningTaskId = nextTask.taskId;
      slot.worker.postMessage(nextTask);
    }
  }

  private cancelTask(taskId: number, error: RenderExecutionError) {
    const pending = this.pending.get(taskId);
    if (!pending) return;

    this.pending.delete(taskId);
    clearTimeout(pending.timeout);
    this.cleanupPendingTask(pending);

    const queueIndex = this.queue.findIndex((task) => task.taskId === taskId);
    if (queueIndex >= 0) this.queue.splice(queueIndex, 1);

    pending.reject(error);
  }

  private cleanupPendingTask(task: PendingRenderTask) {
    if (task.signal && task.onAbort) {
      task.signal.removeEventListener("abort", task.onAbort);
    }
  }
}

type RenderOptions = {
  fonts?: Record<string, string>;
  keepComments?: boolean;
  minify?: boolean;
};

function isAuthorized(req: IncomingMessage, apiKey: string): boolean {
  const header = req.headers["authorization"];
  if (!header || !header.startsWith("Bearer ")) return false;
  const provided = header.slice(7);
  if (provided.length !== apiKey.length) return false;
  return timingSafeEqual(Buffer.from(provided), Buffer.from(apiKey));
}

function getPathname(req: IncomingMessage): string | null {
  try {
    return new URL(req.url ?? "/", "http://localhost").pathname;
  } catch {
    return null;
  }
}

function contentLengthExceedsLimit(req: IncomingMessage, maxBytes: number): boolean {
  const contentLength = req.headers["content-length"];
  if (!contentLength) return false;
  const value = Array.isArray(contentLength) ? contentLength[0] : contentLength;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > maxBytes;
}

function readBody(req: IncomingMessage, maxBytes: number, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let totalBytes = 0;
    let settled = false;

    const finishWithError = (error: BodyReadError) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      req.off("data", onData);
      req.off("end", onEnd);
      req.off("error", onError);
      req.off("aborted", onAborted);
      reject(error);
    };

    const onData = (chunk: Buffer | string) => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      totalBytes += buffer.length;

      if (totalBytes > maxBytes) {
        req.destroy();
        finishWithError(
          new BodyReadError("BODY_TOO_LARGE", "Request body exceeds the maximum size"),
        );
        return;
      }

      chunks.push(buffer);
    };

    const onEnd = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(Buffer.concat(chunks).toString("utf8"));
    };

    const onError = () => {
      finishWithError(new BodyReadError("BODY_READ_FAILED", "Failed to read request body"));
    };

    const onAborted = () => {
      finishWithError(new BodyReadError("BODY_ABORTED", "Request body read was aborted"));
    };

    const timeout = setTimeout(() => {
      req.destroy();
      finishWithError(
        new BodyReadError(
          "BODY_TIMEOUT",
          "Request body was not received within the allowed timeout",
        ),
      );
    }, timeoutMs);

    req.on("data", onData);
    req.once("end", onEnd);
    req.once("error", onError);
    req.once("aborted", onAborted);
  });
}

function parseRenderOptions(value: unknown): { options: RenderOptions } | { error: string } {
  if (value === undefined) return { options: {} };
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { error: 'Invalid "options" field: must be an object' };
  }

  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!ALLOWED_RENDER_OPTIONS.has(key)) {
      return { error: `Invalid "options" field: unknown option "${key}"` };
    }
  }

  const options: RenderOptions = {};

  if ("fonts" in record) {
    const fonts = record.fonts;
    if (typeof fonts !== "object" || fonts === null || Array.isArray(fonts)) {
      return { error: 'Invalid "options.fonts" field: must be an object of string values' };
    }

    for (const [fontName, fontUrl] of Object.entries(fonts)) {
      if (typeof fontUrl !== "string") {
        return {
          error: `Invalid "options.fonts.${fontName}" field: must be a string URL`,
        };
      }

      let parsedUrl: URL;
      try {
        parsedUrl = new URL(fontUrl);
      } catch {
        return { error: `Invalid "options.fonts.${fontName}" field: must be a valid URL` };
      }

      if (parsedUrl.protocol !== "https:") {
        return {
          error: `Invalid "options.fonts.${fontName}" field: only https URLs are allowed`,
        };
      }
    }

    options.fonts = fonts as Record<string, string>;
  }

  if ("keepComments" in record) {
    if (typeof record.keepComments !== "boolean") {
      return { error: 'Invalid "options.keepComments" field: must be a boolean' };
    }
    options.keepComments = record.keepComments;
  }

  if ("minify" in record) {
    if (typeof record.minify !== "boolean") {
      return { error: 'Invalid "options.minify" field: must be a boolean' };
    }
    options.minify = record.minify;
  }

  return { options };
}

function createRequestHandler(
  apiKey: string,
  renderWorker: RenderWorkerPool,
  rateLimiter: SlidingWindowRateLimiter,
) {
  return async function requestHandler(req: IncomingMessage, res: ServerResponse) {
    const pathname = getPathname(req);
    if (pathname === null) {
      res.writeHead(400, JSON_CT);
      res.end(JSON.stringify({ message: "Invalid request URL" }));
      return;
    }

    if (pathname === "/health") {
      res.writeHead(200, JSON_CT);
      res.end(JSON.stringify({ status: "ok" }));
      return;
    }

    if (!isAuthorized(req, apiKey)) {
      res.writeHead(401, JSON_CT);
      res.end(UNAUTHORIZED);
      return;
    }

    if (pathname === "/" && req.method === "GET") {
      res.writeHead(200, JSON_CT);
      res.end(
        JSON.stringify({
          name: "node25-ts-api-server",
          message: "API server is running",
          endpoints: ["/health", "POST /v1/render"],
        }),
      );
      return;
    }

    if (pathname === "/v1/render" && req.method === "POST") {
      const clientId = req.socket.remoteAddress ?? "unknown";
      if (!rateLimiter.allow(clientId)) {
        res.writeHead(429, JSON_CT);
        res.end(JSON.stringify({ message: "Too many requests; please retry later" }));
        return;
      }

      if (contentLengthExceedsLimit(req, MAX_RENDER_BODY_BYTES)) {
        res.writeHead(413, JSON_CT);
        res.end(
          JSON.stringify({
            message: `Request body is too large (max ${MAX_RENDER_BODY_BYTES} bytes)`,
          }),
        );
        return;
      }

      let body: string;
      try {
        body = await readBody(req, MAX_RENDER_BODY_BYTES, BODY_READ_TIMEOUT_MS);
      } catch (error) {
        if (error instanceof BodyReadError && error.code === "BODY_TOO_LARGE") {
          res.writeHead(413, JSON_CT);
          res.end(
            JSON.stringify({
              message: `Request body is too large (max ${MAX_RENDER_BODY_BYTES} bytes)`,
            }),
          );
          return;
        }

        if (error instanceof BodyReadError && error.code === "BODY_TIMEOUT") {
          res.writeHead(408, JSON_CT);
          res.end(JSON.stringify({ message: "Request body read timed out" }));
          return;
        }

        res.writeHead(422, JSON_CT);
        res.end(JSON.stringify({ message: "Failed to read request body" }));
        return;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(body);
      } catch {
        res.writeHead(422, JSON_CT);
        res.end(JSON.stringify({ message: "Invalid JSON body" }));
        return;
      }

      if (
        typeof parsed !== "object" ||
        parsed === null ||
        !("mjml" in parsed) ||
        typeof (parsed as Record<string, unknown>)["mjml"] !== "string"
      ) {
        res.writeHead(422, JSON_CT);
        res.end(JSON.stringify({ message: 'Missing or invalid "mjml" field: must be a string' }));
        return;
      }

      const parsedRecord = parsed as Record<string, unknown>;
      const mjmlInput = parsedRecord.mjml as string;
      const optionsResult = parseRenderOptions(parsedRecord.options);
      if ("error" in optionsResult) {
        res.writeHead(422, JSON_CT);
        res.end(JSON.stringify({ message: optionsResult.error }));
        return;
      }

      const renderOptions = optionsResult.options;

      const abortController = new AbortController();
      const onResponseClose = () => {
        if (!res.writableEnded) abortController.abort();
      };
      res.once("close", onResponseClose);

      let renderResult: {
        html: string;
        errors: Array<{ tagName: string; message: string; line: number }>;
      };
      try {
        renderResult = await renderWorker.render(mjmlInput, renderOptions, abortController.signal);
      } catch (error) {
        if (error instanceof RenderExecutionError) {
          if (error.statusCode === 499 && res.destroyed) {
            return;
          }
          res.writeHead(error.statusCode, JSON_CT);
          res.end(JSON.stringify({ message: error.message }));
          return;
        }

        res.writeHead(500, JSON_CT);
        res.end(JSON.stringify({ message: "Failed to render MJML" }));
        return;
      } finally {
        res.off("close", onResponseClose);
      }

      res.writeHead(200, JSON_CT);
      res.end(JSON.stringify({ html: renderResult.html, errors: renderResult.errors }));
      return;
    }

    res.writeHead(404, JSON_CT);
    res.end(JSON.stringify({ message: "Not found" }));
  };
}

export function createApiServer(apiKey: string, options: ApiServerOptions = {}) {
  const renderWorker = new RenderWorkerPool(options);
  const rateLimiter = new SlidingWindowRateLimiter(options);
  const server = createServer(createRequestHandler(apiKey, renderWorker, rateLimiter));
  server.requestTimeout = BODY_READ_TIMEOUT_MS + 5_000;
  server.headersTimeout = BODY_READ_TIMEOUT_MS + 5_000;
  server.on("close", () => {
    void renderWorker.close();
  });
  return server;
}
