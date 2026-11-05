# Dependabot updates the pinned image digests. Update the pnpm version by hand.

# Production dependencies stage
FROM node:26-trixie-slim@sha256:5adad64f9a1fca2d51972caa65983634c8a774eb300d72b20f7f2a0f60368072 AS deps-prod

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Node 26 slim images may not ship corepack; install pnpm explicitly.
RUN npm install -g pnpm@12.16.1 && pnpm install --prod --frozen-lockfile

# Runtime stage: distroless image without a shell or package manager
FROM gcr.io/distroless/nodejs26-debian13:nonroot@sha256:9b945e92c1b5463a4b75f11e8417515e4bea7355f6adfd79ec220fbbe905dda8

WORKDIR /app

# Application files stay root-owned so the runtime user cannot modify them.
COPY --from=deps-prod /app/package.json /app/pnpm-lock.yaml ./
COPY --from=deps-prod /app/node_modules ./node_modules
COPY src ./src

ENV NODE_ENV=production

EXPOSE 3000

USER nonroot

# The image entrypoint is the node binary.
CMD ["src/index.ts"]
