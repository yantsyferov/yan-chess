# syntax=docker/dockerfile:1.6
# ─── Stage 1: deps ────────────────────────────────────────────────────────────
FROM node:22-alpine AS deps

WORKDIR /app

# Enable corepack and install the pinned pnpm version
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# Copy manifests only — maximises layer cache reuse on source-only changes
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/package.json
COPY packages/shared/package.json ./packages/shared/package.json
# Prisma schema required by @prisma/client postinstall and prisma generate
COPY apps/api/prisma ./apps/api/prisma

# Fetch all packages into the pnpm content-addressable store
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm fetch

# Install all deps (dev included — needed for Prisma generate + nest build)
# --ignore-scripts avoids running prisma generate before source is copied
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --offline --frozen-lockfile --ignore-scripts

# ─── Stage 2: build ───────────────────────────────────────────────────────────
FROM deps AS build

# Copy full monorepo source on top of the installed node_modules
COPY . .

# 1. Build the shared package so api can resolve @yanchess/shared
RUN pnpm --filter @yanchess/shared build

# 2. Generate Prisma Client (reads apps/api/prisma/schema.prisma)
RUN pnpm --filter api prisma:generate

# 3. Compile API via NestJS/SWC → apps/api/dist/
RUN pnpm --filter api build

# 4. Use pnpm deploy to create a self-contained prod-only directory
#    This resolves workspace deps, copies only production node_modules, and
#    correctly handles symlinks — purpose-built for this exact use case.
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm --filter api deploy --prod /deploy

# pnpm deploy does NOT copy the build output (dist/) — add it manually
RUN cp -r /app/apps/api/dist /deploy/dist
# Also copy Prisma schema + migrations (needed by Prisma Client at runtime)
RUN cp -r /app/apps/api/prisma /deploy/prisma
# Override the Prisma Client in /deploy with the schema-aware one from /app.
# pnpm deploy regenerates the client without a schema, losing enums — we fix
# that by overwriting with the client that was generated in the build stage.
# We must copy BOTH @prisma/client (wrapper) and .prisma/client (generated output).
# We keep ONLY the openssl-3.0.x engine binary to reduce image size.
RUN cp -r /app/node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/@prisma/client/. \
          /deploy/node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/@prisma/client/ && \
    mkdir -p /deploy/node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/.prisma/client && \
    cp -r /app/node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/.prisma/client/. \
          /deploy/node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/.prisma/client/ && \
    rm -f /deploy/node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/.prisma/client/libquery_engine-linux-musl-arm64-openssl-1.1.x.so.node

# ─── Stage 3: runtime ─────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime

WORKDIR /app

# Install OpenSSL 1.1 — required by the Prisma query engine binary
# (Alpine ships OpenSSL 3 by default; Prisma 5.x still ships a 1.1.x engine)
RUN apk add --no-cache openssl

# pnpm deploy created a self-contained directory with prod node_modules,
# package.json, and the workspace dep (@yanchess/shared) already inlined.
COPY --from=build /deploy ./

EXPOSE 3000

CMD ["node", "dist/main.js"]
