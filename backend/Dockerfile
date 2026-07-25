# syntax=docker/dockerfile:1

ARG NODE_VERSION=22.23.1
ARG PNPM_VERSION=10.32.1

################################################################────────────────
FROM node:${NODE_VERSION}-alpine AS base
WORKDIR /usr/src/app
RUN --mount=type=cache,target=/root/.npm \
    npm install -g pnpm@${PNPM_VERSION}

################################################################────────────────
# Full deps (including dev) — needed to run `nest build`
FROM base AS deps
COPY backend/package.json backend/pnpm-lock.yaml backend/pnpm-workspace.yaml ./
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --prefer-offline --trust-lockfile

################################################################────────────────
FROM deps AS build
ARG DATABASE_URL

COPY protos ./protos
COPY backend ./

RUN if [ ! -f .env ]; then \
      : "${DATABASE_URL:=postgresql://dummy:[REDACTED]@localhost:5432/dummy}"; \
      printf 'DATABASE_URL=%s\n' "$DATABASE_URL" > .env; \
      printf 'DIRECT_URL=%s\n' "$DATABASE_URL" >> .env; \
    fi && \
    pnpm prisma generate

RUN pnpm run build

# Create prod deps only — aggressive pruning
RUN pnpm --filter medtrack-hub-backend install --prod --frozen-lockfile

# Strip and prune aggressively for final image
RUN mkdir -p /prod && \
    cp -a package.json prisma prisma.config.ts dist /prod/ && \
    cp -a node_modules /prod/ && \
    cd /prod && \
    find node_modules -type f \( -name "*.md" -o -name "*.map" -o -name "*.ts" -o -name "*.test.js" -o -name "*.spec.js" \) -delete && \
    find node_modules -type d \( -name "test" -o -name "tests" -o -name "example" -o -name "examples" -o -name "docs" -o -name ".bin" \) -prune -exec rm -rf {} + 2>/dev/null || true && \
    rm -rf node_modules/@swc node_modules/@next node_modules/typescript node_modules/ts-node node_modules/eslint* node_modules/@eslint* node_modules/@types node_modules/jest* node_modules/supertest* node_modules/prettier* 2>/dev/null || true && \
    du -sh .

################################################################────────────────
FROM node:${NODE_VERSION}-alpine AS final
ENV NODE_ENV=production
ENV PORT=3002
ENV HOSTNAME=0.0.0.0
WORKDIR /usr/src/app
COPY --chown=node:node --from=build /prod ./
USER node

EXPOSE 3002

HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3002/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

CMD ["sh", "-c", "set -e; if [ -n \"$DATABASE_URL\" ]; then echo 'DATABASE_URL present — running migrations'; timeout 120 ./node_modules/.bin/prisma migrate deploy || { code=$?; if [ $code -ne 124 ]; then echo 'Migration failed with exit code '\"$code\"''; exit $code; fi; echo 'Migration timeout after 120s, continuing startup'; }; else echo 'DATABASE_URL not set — skipping migrations'; fi; echo 'Starting application'; exec node dist/src/main"]
