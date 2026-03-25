import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { timingSafeEqual } from "node:crypto";
import mjml2html from "mjml";

const UNAUTHORIZED = JSON.stringify({ message: "Unauthorized" });
const JSON_CT = { "content-type": "application/json" };

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

      const mjmlInput = (parsed as Record<string, string>)["mjml"];
      const result = mjml2html(mjmlInput, { validationLevel: "soft" });

      const errors = result.errors.map((e) => ({
        tagName: e.tagName,
        message: e.message,
        line: e.line,
      }));

      res.writeHead(200, JSON_CT);
      res.end(JSON.stringify({ html: result.html, errors }));
      return;
    }

    res.writeHead(404, JSON_CT);
    res.end(JSON.stringify({ message: "Not found" }));
  };
}

export function createApiServer(apiKey: string) {
  return createServer(createRequestHandler(apiKey));
}
