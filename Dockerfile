# Production dependencies stage
FROM node:25-trixie-slim AS deps-prod

WORKDIR /app

COPY package.json pnpm-lock.yaml ./

# Node 25 slim images may not ship corepack; install pnpm explicitly.
RUN npm install -g pnpm@10 && pnpm install --prod --frozen-lockfile

# Runtime stage: copies production dependencies and runs src directly
FROM node:25-trixie-slim

RUN mkdir -p /app && chown node:node /app

WORKDIR /app

COPY --from=deps-prod /app/package.json /app/pnpm-lock.yaml ./
COPY --from=deps-prod /app/node_modules ./node_modules
COPY --chown=node:node src ./src

ENV NODE_ENV=production

EXPOSE 3000

USER node

CMD ["node", "src/index.ts"]
