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
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --prefer-offline

################################################################────────────────
FROM deps AS build
ARG DATABASE_URL

# Copy protos (if present in build context) so backend can use shared proto types
# when building from a per-service context. The `scripts/sync-protos.sh` script
# will populate `backend/protos` prior to a per-service build.
COPY protos ./protos

# Copy service source
COPY . .

# DATABASE_URL used transiently for `prisma generate` schema introspection
# only — never persisted as ENV, so it never lands in the final image.
RUN if [ ! -f .env ]; then \
      if [ -n "$DATABASE_URL" ]; then \
        printf 'DATABASE_URL=%s\n' "$DATABASE_URL" > .env; \
        printf 'DIRECT_URL=%s\n' "$DATABASE_URL" >> .env; \
      else \
        # Fallback to a local SQLite file for offline generation during image builds
        printf 'DATABASE_URL=%s\n' "file:./dev.db" > .env; \
        printf 'DIRECT_URL=%s\n' "file:./dev.db" >> .env; \
      fi; \
    fi && \
    # Load env values and run Prisma generation with both variables available
    export $(cat .env | xargs) && pnpm prisma generate
RUN pnpm run build
RUN mkdir -p /prod && \
  # Install only production dependencies for the backend package and assemble runtime
  pnpm --filter medtrack-hub-backend install --prod --frozen-lockfile && \
  # Copy runtime files into /prod
  cp -a package.json prisma prisma.config.ts dist node_modules /prod 2>/dev/null || true

################################################################────────────────
FROM node:${NODE_VERSION}-alpine AS final
ENV NODE_ENV=production
ENV PORT=3002
ENV HOSTNAME=0.0.0.0

WORKDIR /usr/src/app

COPY --chown=node:node --from=build /prod ./
COPY --chown=node:node --from=build /usr/src/app/dist ./dist
COPY --chown=node:node --from=build /usr/src/app/prisma ./prisma
COPY --chown=node:node --from=build /usr/src/app/prisma.config.ts ./prisma.config.ts

USER node

EXPOSE 3002

HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3002/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

CMD ["sh", "-c", "if [ -n \"$DATABASE_URL\" ]; then echo 'DATABASE_URL present — running migrations'; ./node_modules/.bin/prisma migrate deploy; else echo 'DATABASE_URL not set — skipping migrations'; fi && node dist/src/main"]