ARG NODE_VERSION=22.14.0
ARG PNPM_VERSION=8.15.0

# Base image
FROM node:${NODE_VERSION}-alpine AS base
WORKDIR /usr/src/app

RUN npm install -g pnpm@${PNPM_VERSION}

# Builder stage — installs full deps (incl. dev), generates Prisma client,
# builds, then prunes to production-only.
FROM base AS builder
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --no-frozen-lockfile
COPY . .
RUN pnpm prisma generate
RUN pnpm run build
# Prune AFTER generate+build so the generated Prisma client survives.
RUN pnpm prune --prod

# Production stage — minimal base, no pnpm/corepack needed
FROM node:${NODE_VERSION}-alpine AS production
WORKDIR /usr/src/app

RUN apk add --no-cache ca-certificates

ENV NODE_ENV=production

COPY --from=builder /usr/src/app/package.json ./
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/dist ./dist

# Create non-root user and set ownership
RUN adduser -D appuser && chown -R appuser:appuser /usr/src/app
USER appuser

EXPOSE 3002

# Node.js-based healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3002/api/health', (res) => { if (res.statusCode === 200) process.exit(0); process.exit(1); })" || exit 1

CMD ["node", "dist/main.js"]
