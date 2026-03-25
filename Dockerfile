# Builder stage: installs all dependencies including devDependencies
FROM node:25-trixie-slim AS builder

WORKDIR /app

COPY package.json pnpm-lock.yaml ./

# Node 25 slim images may not ship corepack; install pnpm explicitly.
RUN npm install -g pnpm@10 && pnpm install --frozen-lockfile

COPY . .

# Runtime stage: installs production dependencies only and runs src directly
FROM node:25-trixie-slim

RUN mkdir -p /app && chown node:node /app

WORKDIR /app

RUN npm install -g pnpm@10

COPY --from=builder /app/package.json /app/pnpm-lock.yaml ./

RUN pnpm install --prod --frozen-lockfile

COPY --from=builder /app/src ./src

ENV NODE_ENV=production

EXPOSE 3000

USER node

CMD ["node", "src/index.ts"]
