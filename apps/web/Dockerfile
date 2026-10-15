# syntax=docker/dockerfile:1.6
FROM node:22-alpine AS deps

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/

RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# ── build ─────────────────────────────────────────────────────────────────────
FROM deps AS build

ARG VITE_API_URL=http://localhost:3000/api/v1
ENV VITE_API_URL=${VITE_API_URL}

COPY packages/shared/ packages/shared/
COPY apps/web/ apps/web/
COPY tsconfig.base.json ./

RUN pnpm --filter @yanchess/shared build && \
    pnpm --filter web build

# ── runtime ───────────────────────────────────────────────────────────────────
FROM caddy:alpine AS runtime

COPY --from=build /app/apps/web/dist/ /srv/
COPY apps/web/Caddyfile /etc/caddy/Caddyfile

EXPOSE 80
