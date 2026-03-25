import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { minify as minifyHtml } from "html-minifier-terser";
import mjml2html from "mjml";

const UNAUTHORIZED = JSON.stringify({ message: "Unauthorized" });
const JSON_CT = { "content-type": "application/json" };
const ALLOWED_RENDER_OPTIONS = new Set(["fonts", "keepComments", "minify"]);
const SAFE_HTML_MINIFIER_CONFIG = {
  collapseWhitespace: true,
  conservativeCollapse: true,
  minifyCSS: true,
  caseSensitive: true,
  keepClosingSlash: true,
  removeComments: false,
};

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

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
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

function createRequestHandler(apiKey: string) {
  return async function requestHandler(req: IncomingMessage, res: ServerResponse) {
    if (req.url === "/health") {
      res.writeHead(200, JSON_CT);
      res.end(JSON.stringify({ status: "ok" }));
      return;
    }

    if (!isAuthorized(req, apiKey)) {
      res.writeHead(401, JSON_CT);
      res.end(UNAUTHORIZED);
      return;
    }

    if (req.url === "/" && req.method === "GET") {
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

    if (req.url === "/v1/render" && req.method === "POST") {
      let body: string;
      try {
        body = await readBody(req);
      } catch {
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
      const mjmlOptions: {
        validationLevel: "soft";
        fonts?: Record<string, string>;
        keepComments?: boolean;
      } = { validationLevel: "soft" };

      if (renderOptions.fonts !== undefined) mjmlOptions.fonts = renderOptions.fonts;
      if (renderOptions.keepComments !== undefined) {
        mjmlOptions.keepComments = renderOptions.keepComments;
      }

      const result = mjml2html(mjmlInput, mjmlOptions);
      let htmlOutput = result.html;

      if (renderOptions.minify === true) {
        try {
          htmlOutput = await minifyHtml(htmlOutput, SAFE_HTML_MINIFIER_CONFIG);
        } catch {
          res.writeHead(422, JSON_CT);
          res.end(JSON.stringify({ message: "Failed to minify rendered HTML" }));
          return;
        }
      }

      const errors = result.errors.map((e) => ({
        tagName: e.tagName,
        message: e.message,
        line: e.line,
      }));

      res.writeHead(200, JSON_CT);
      res.end(JSON.stringify({ html: htmlOutput, errors }));
      return;
    }

    res.writeHead(404, JSON_CT);
    res.end(JSON.stringify({ message: "Not found" }));
  };
}

export function createApiServer(apiKey: string) {
  return createServer(createRequestHandler(apiKey));
}
