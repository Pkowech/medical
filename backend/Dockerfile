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
# Build-script approvals now live in package.json's "pnpm.onlyBuiltDependencies"
# field, so no interactive/fallback approve-builds step is needed here — and
# because it's committed in package.json, the approval survives being copied
# fresh into the build stage below (a runtime `approve-builds --all` call did
# NOT survive that, since COPY backend ./ overwrote the approved package.json).
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --prefer-offline --trust-lockfile

################################################################────────────────
FROM deps AS build
ARG DATABASE_URL

# Copy root-level protos into the backend build context, so the backend can
# compile and load proto definitions from the workspace root.
COPY protos ./protos

# Copy backend service source and config files from the repository root.
COPY backend ./

# DATABASE_URL used transiently for `prisma generate` schema introspection
# only — never persisted as ENV, so it never lands in the final image.
#
# Note: prisma.config.ts does `import 'dotenv/config'` and reads values via
# env<Env>('DATABASE_URL'/'DIRECT_URL'), so Prisma loads the .env file itself —
# no need to `export` values into the shell before invoking the CLI.
#
# The fallback MUST be a syntactically valid postgresql:// URL, since the
# schema's datasource provider is "postgresql". A sqlite-style file: URL
# fails Prisma's datasource validation (P1012) even though generate never
# actually connects to the DB.
RUN if [ ! -f .env ]; then \
      : "${DATABASE_URL:=postgresql://dummy:dummy@localhost:5432/dummy}"; \
      printf 'DATABASE_URL=%s\n' "$DATABASE_URL" > .env; \
      printf 'DIRECT_URL=%s\n' "$DATABASE_URL" >> .env; \
    fi && \
    pnpm prisma generate

RUN pnpm run build
RUN mkdir -p /prod && \
    pnpm --filter medtrack-hub-backend install --prod --frozen-lockfile && \
    cp -a package.json prisma prisma.config.ts dist node_modules /prod

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

CMD ["sh", "-c", "if [ -n \"$DATABASE_URL\" ]; then echo 'DATABASE_URL present — running migrations'; ./node_modules/.bin/prisma migrate deploy; else echo 'DATABASE_URL not set — skipping migrations'; fi && node dist/src/main"]
