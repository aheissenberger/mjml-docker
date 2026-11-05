# Production dependencies stage
FROM node:26-trixie-slim AS deps-prod

WORKDIR /app

COPY package.json pnpm-lock.yaml ./

# Node 26 slim images may not ship corepack; install pnpm explicitly.
RUN npm install -g pnpm@12 && pnpm install --prod --frozen-lockfile

# Runtime stage: copies production dependencies and runs src directly
FROM node:26-trixie-slim

WORKDIR /app

# Application files stay root-owned so the runtime user cannot modify them.
COPY --from=deps-prod /app/package.json /app/pnpm-lock.yaml ./
COPY --from=deps-prod /app/node_modules ./node_modules
COPY src ./src

ENV NODE_ENV=production

EXPOSE 3000

USER node

CMD ["node", "src/index.ts"]
