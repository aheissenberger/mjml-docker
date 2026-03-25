import { createApiServer } from "./server.ts";

const port = Number(process.env.PORT ?? 3000);
const server = createApiServer();

server.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
