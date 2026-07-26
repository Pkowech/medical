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
RUN echo "DATABASE_URL=postgresql://dummy:[REDACTED]@localhost:5432/dummy" > .env && \
    echo "DIRECT_URL=postgresql://dummy:[REDACTED]@localhost:5432/dummy" >> .env && \
    echo "JWT_SECRET=build-time-dummy" >> .env && \
    echo "JWT_REFRESH_SECRET=build-time-dummy-refresh" >> .env && \
    pnpm prisma generate

# Prisma 7 ships WASM query compilers for every supported database
# (postgresql/mysql/sqlite/cockroachdb/sqlserver) in @prisma/client — ~70MB of
# it is dead weight since this service only uses @prisma/adapter-pg.
# Strip everything but postgresql, plus source maps (not needed at runtime).
# See: https://github.com/prisma/prisma/discussions/29095
RUN find node_modules/@prisma/client -type f \
      \( -iname "query_compiler_*" -o -iname "*.wasm" \) \
      ! -iname "*postgresql*" -delete 2>/dev/null || true && \
    find node_modules/@prisma/client -type f -iname "*.map" -delete 2>/dev/null || true && \
    echo "@prisma/client size after strip:" && du -sh node_modules/@prisma/client 2>/dev/null || true

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
      --external:'@prisma/client-runtime-utils' \
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
# Stage 4: prod-deps — ISOLATED install of only the native/external
#   packages esbuild couldn't bundle (argon2, sharp, @prisma/client shell).
#
#   Deliberately NOT installing from backend/package.json — doing that
#   installs pnpm's --prod resolution of the ENTIRE dependency list, which
#   reinstalls everything esbuild already inlined into dist/bundle.js
#   (@nestjs/*, express, aws-sdk, cloudinary, bullmq, etc.). That duplication
#   is what previously bloated the image to 864MB.
#
#   This tiny standalone manifest, installed in its own empty directory,
#   lets pnpm resolve ONLY the transitive closure these 4 packages actually
#   need — including small runtime helpers like node-gyp-build, detect-libc,
#   and semver automatically, with no more manual discovery via failed
#   deploys.
################################################################
FROM base AS prod-deps
WORKDIR /prod-deps
RUN cat <<'EOF' > package.json
{
  "name": "medtrack-native-deps",
  "private": true,
  "dependencies": {
    "argon2": "^0.41.1",
    "sharp": "^0.34.5",
    "@prisma/client": "^7.8.0",
    "@prisma/client-runtime-utils": "^7.8.0"
  }
}
EOF

# --ignore-scripts avoids @prisma/client's postinstall (`prisma generate`),
# which would fail here — there's no schema.prisma or prisma CLI in this
# isolated install, and we don't need one: the generated .prisma/client
# (with the linux-musl query engine) is copied from the `build` stage
# instead. We DO need install scripts for argon2/sharp though, since those
# fetch/build their platform-specific prebuilt binaries — so rebuild just
# those two explicitly after the ignore-scripts install.
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --prod --ignore-scripts --shamefully-hoist && \
    pnpm rebuild argon2 sharp

# Strip sharp to runtime-only files
RUN find node_modules/sharp -type d \( -name build -o -name docs -o -name test -o -name src \) -exec rm -rf {} + 2>/dev/null || true && \
    find node_modules/sharp -type f \( -name "*.ts" -o -name "*.cc" -o -name "*.h" \) -delete 2>/dev/null || true && \
    find node_modules/@img -type f \( -name "*.ts" -o -name "*.cc" -o -name "*.h" \) -delete 2>/dev/null || true

# General dead-weight trim — safe here since this tree contains ONLY these
# 4 packages + their transitive deps, no dev dependencies were ever installed
RUN find node_modules -type d \( -name test -o -name tests -o -name __tests__ -o -name docs -o -name .github \) -exec rm -rf {} + 2>/dev/null || true && \
    find node_modules -type f \( -name "*.md" -o -name "*.map" -o -name "LICENSE*" \) -delete 2>/dev/null || true

# Remove the @prisma/client shell's own bundled engines/wasm — we only want
# the JS client API here; the actual generated client + musl engine binary
# comes from the `build` stage's `prisma generate` output, copied in Stage 5
RUN rm -rf node_modules/@prisma/engines node_modules/.prisma 2>/dev/null || true

# Sanity check against this exact tree — matches what Stage 5 will copy
RUN node -e "require('argon2'); require('sharp'); console.log('native modules load OK in prod-deps')"

RUN du -sh node_modules 2>/dev/null || true

################################################################
# Stage 5: final — minimal production image
#
# Target: <300MB total (includes node:22-alpine base ~163MB + app layers)
#
# node_modules now comes from the ISOLATED prod-deps install (Stage 4),
# not from installing backend/package.json's full prod dependency list.
# That isolated tree contains only argon2 + sharp + @prisma/client-shell
# and their genuine transitive runtime deps (node-gyp-build, detect-libc,
# semver, etc. — resolved automatically by pnpm, not guessed one deploy
# at a time). Everything else the app needs is already inside dist/bundle.js.
#
# Layer breakdown after bundling:
#   ~120MB  node:22-alpine base (node binary, openssl, ca-certs)
#   ~30MB   dist/bundle.js (entire app JS, bundled with esbuild)
#   ~35MB   node_modules (isolated: sharp + @img, argon2 + helpers,
#           @prisma/client JS shell, @prisma/client-runtime-utils)
#   ~6MB    .prisma/client (libquery_engine-linux-musl binary, from build stage)
#   <1MB    prisma/schema.prisma + package.json
#   ------
#   ~195MB total
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

# ── The esbuild bundle replaces all bundled JS node_modules ──────────────────
COPY --chown=nestjs:nodejs --from=build /usr/src/app/dist/bundle.js ./dist/main.js

# ── Isolated native-addon node_modules (argon2, sharp, @prisma/client shell,
#    and their real transitive runtime deps) — see Stage 4 for rationale ────
COPY --chown=nestjs:nodejs --from=prod-deps /prod-deps/node_modules ./node_modules

# ── Prisma query engine binary — generated client + linux-musl engine only
#    exist in the `build` stage (prod-deps deliberately has no schema/CLI) ──
COPY --chown=nestjs:nodejs --from=build /usr/src/app/node_modules/.prisma/client ./node_modules/.prisma/client

# ── App metadata ──────────────────────────────────────────────────────────────
# Copy ONLY schema (needed for runtime introspection if any); skip migrations
COPY --chown=nestjs:nodejs --from=build /usr/src/app/prisma/schema.prisma ./prisma/
COPY --chown=nestjs:nodejs --from=build /usr/src/app/package.json ./

# ── Proto files — the gRPC module resolves these at runtime, not bundle-time ──
COPY --chown=nestjs:nodejs --from=build /usr/src/app/protos /usr/src/protos

USER nestjs

EXPOSE 3002

CMD ["node", "dist/main.js"]