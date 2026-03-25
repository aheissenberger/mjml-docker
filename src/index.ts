import { createApiServer } from "./server.ts";

const apiKey = process.env.API_KEY;
if (!apiKey) {
  process.stderr.write("Error: API_KEY environment variable is not set. Server cannot start.\n");
  process.exit(1);
}

const port = Number(process.env.PORT ?? 3000);
const server = createApiServer(apiKey);

server.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
