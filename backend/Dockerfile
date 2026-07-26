# syntax=docker/dockerfile:1

ARG NODE_VERSION=22.23.1
ARG PNPM_VERSION=11.17.0

################################################################
# Stage 1: base — node + pnpm
################################################################
FROM node:${NODE_VERSION}-alpine AS base
WORKDIR /usr/src/app
RUN npm install -g pnpm@${PNPM_VERSION} --no-fund --no-audit && \
    npm cache clean --force

################################################################
# Stage 2: deps — install ALL deps with ignore-scripts (fast)
################################################################
FROM base AS deps
COPY backend/package.json backend/pnpm-lock.yaml backend/pnpm-workspace.yaml ./
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --prefer-offline --ignore-scripts

################################################################
# Stage 3: build — compile + generate prisma + esbuild bundle
################################################################
FROM deps AS build
# Use root protos (canonical source of truth)
COPY protos ./protos
# Copy source only (node_modules excluded via .dockerignore)
COPY backend ./

# Reinstall fresh Linux-native binaries using pnpm store cache
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    rm -rf node_modules && \
    pnpm install --frozen-lockfile --ignore-scripts=false

# Generate Prisma client (dummy URL — only schema parsing needed)
RUN echo "DATABASE_URL=postgresql://dummy:dummy@localhost:5432/dummy" > .env && \
    echo "DIRECT_URL=postgresql://dummy:dummy@localhost:5432/dummy" >> .env && \
    echo "JWT_SECRET=build-time-dummy" >> .env && \
    echo "JWT_REFRESH_SECRET=build-time-dummy-refresh" >> .env && \
    pnpm prisma generate

# pnpm stores engine binary and generated client inside virtual store (node_modules/.pnpm/...).
# Copy to standard node_modules/.prisma and node_modules/@prisma/client so the final stage COPY can find them.
RUN mkdir -p node_modules/.prisma/client node_modules/@prisma/client && \
    find node_modules/.pnpm -name "libquery_engine*linux-musl*" -type f \
      -exec cp {} node_modules/.prisma/client/ \; 2>/dev/null || true && \
    find node_modules/.pnpm -path "*/.prisma/client/*" -type f \
      -exec cp {} node_modules/.prisma/client/ \; 2>/dev/null || true && \
    find node_modules/.pnpm -path "*/@prisma/client/*" -type f \
      -exec cp {} node_modules/@prisma/client/ \; 2>/dev/null || true && \
    echo "Prisma engine & client files:" && ls node_modules/.prisma/client/ 2>/dev/null || true

# Compile TypeScript — must succeed before esbuild
RUN pnpm run build
# Strip source maps (reduces bundle input size, || true is safe here)
RUN find dist -name "*.js.map" -delete 2>/dev/null || true

# Install esbuild (not in package.json — build-time only tool)
RUN npm install -g esbuild --no-fund --no-audit --prefer-offline 2>/dev/null; \
    npm cache clean --force

# Bundle entire app into single file with esbuild.
# --keep-names: required for NestJS decorator/DI metadata (reflect-metadata).
# NestJS microservices uses loadPackage() for optional transports — they are
# not installed and NOT needed at runtime; marking as --external skips them.
RUN esbuild dist/src/main.js \
      --bundle \
      --platform=node \
      --target=node22 \
      --outfile=dist/bundle.js \
      --log-limit=0 \
      --external:argon2 \
      --external:sharp \
      --external:'@prisma/client' \
      --external:'.prisma' \
      --external:'@nestjs/websockets' \
      --external:'@nestjs/websockets/socket-module' \
      --external:'@nestjs/platform-socket.io' \
      --external:amqplib \
      --external:amqp-connection-manager \
      --external:nats \
      --external:mqtt \
      --external:kafkajs \
      --external:'socket.io' \
      --external:ws \
      --external:bufferutil \
      --external:'utf-8-validate' \
      --external:'@grpc/proto-loader' \
      --external:redis \
      --external:'@redis/client' \
      --external:'@redis/bloom' \
      --external:'@redis/search' \
      --external:'cache-manager-redis-yet' \
      --external:'@nestjs/mongoose' \
      --external:'@nestjs/typeorm' \
      --external:'@nestjs/sequelize' \
      --external:'@nestjs/mikro-orm' \
      --external:mongoose \
      --external:typeorm \
      --external:sequelize \
      --external:'@mikro-orm/core' \
      --external:'class-transformer/storage' \
      --keep-names \
      --log-level=warning

################################################################
# Stage 4: prod-deps — only for native addons + Prisma binaries
#   Everything else is in the bundle so we don't copy it.
################################################################
FROM base AS prod-deps
COPY backend/package.json backend/pnpm-lock.yaml backend/pnpm-workspace.yaml ./
# Schema needed for `prisma generate` postinstall
COPY backend/prisma/schema.prisma ./prisma/schema.prisma
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --prod --ignore-scripts=false

# --- Strip everything that won't be copied to final anyway ---

# Remove Prisma engine binaries for wrong platforms (keep only linux-musl for Alpine)
RUN find node_modules/@prisma/engines -type f \
      ! -name "*linux-musl*" \
      -delete 2>/dev/null || true && \
    find node_modules/.prisma -type f \
      ! -name "*linux-musl*" \
      -delete 2>/dev/null || true

# Remove heavy Prisma sub-tools not needed for migrate deploy
RUN rm -rf \
    node_modules/@prisma/engines/prisma-fmt-linux-musl* \
    2>/dev/null || true

################################################################
# Stage 5: final — minimal production image
#
# Image composition after bundling (target <300MB):
#   ~120MB  node:22-alpine base + apk packages
#   ~30MB   dist/bundle.js (entire app JS, bundled)
#   ~35MB   node_modules/sharp (native)
#   ~5MB    node_modules/argon2 (native)
#   ~30MB   node_modules/.prisma (linux-musl query engine)
#   ~15MB   node_modules/@prisma/client (runtime JS)
#   ~50MB   node_modules/prisma (CLI for migrate deploy)
#   ~1MB    prisma schema + migrations
#   ------
#   ~286MB total
################################################################
FROM node:${NODE_VERSION}-alpine AS final

# TLS (Neon sslmode=require + Upstash rediss://) and healthcheck
RUN apk add --no-cache ca-certificates tzdata wget && \
    npm cache clean --force

ENV NODE_ENV=production
ENV PORT=3002
ENV HOSTNAME=0.0.0.0

WORKDIR /usr/src/app

# Non-root user — created BEFORE COPY so --chown works without a separate RUN layer
RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001

# ── The esbuild bundle replaces all JS node_modules ──────────────────────────
COPY --chown=nestjs:nodejs --from=build /usr/src/app/dist/bundle.js ./dist/main.js

# ── Native addons (cannot be bundled) ────────────────────────────────────────
COPY --chown=nestjs:nodejs --from=prod-deps /usr/src/app/node_modules/argon2 ./node_modules/argon2
COPY --chown=nestjs:nodejs --from=prod-deps /usr/src/app/node_modules/sharp  ./node_modules/sharp

# ── Prisma — copy generated client & engine from build stage ─────────────────
COPY --chown=nestjs:nodejs --from=build /usr/src/app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --chown=nestjs:nodejs --from=build /usr/src/app/node_modules/.prisma        ./node_modules/.prisma

# ── App metadata ──────────────────────────────────────────────────────────────
COPY --chown=nestjs:nodejs --from=build /usr/src/app/prisma      ./prisma
COPY --chown=nestjs:nodejs --from=build /usr/src/app/package.json ./

USER nestjs

EXPOSE 3002

CMD ["node", "dist/main.js"]