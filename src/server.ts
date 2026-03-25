import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

function requestHandler(req: IncomingMessage, res: ServerResponse) {
  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }

  res.writeHead(200, { "content-type": "application/json" });
  res.end(
    JSON.stringify({
      name: "node25-ts-api-server",
      message: "API server is running",
      endpoints: ["/health"],
    }),
  );
}

export function createApiServer() {
  return createServer(requestHandler);
}
