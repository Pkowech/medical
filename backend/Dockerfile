ARG NODE_VERSION=22.14.0
ARG PNPM_VERSION=8.15.0

# Base image
FROM node:${NODE_VERSION}-alpine AS base
WORKDIR /usr/src/app

# Install build-time system dependencies (minimal)
RUN apk add --no-cache \
    netcat-openbsd \
    postgresql-client

# Install pnpm globally
RUN npm install -g pnpm@${PNPM_VERSION}

# Install production dependencies only
FROM base AS deps
COPY backend/package.json ./
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --prod --no-frozen-lockfile

# Builder stage
FROM base AS builder
COPY backend/package.json ./
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --no-frozen-lockfile
COPY . .
RUN pnpm prisma generate
RUN pnpm run build
# Prune to production-only after build
RUN pnpm prune --prod || true

# Production stage
FROM node:${NODE_VERSION}-alpine AS production
WORKDIR /usr/src/app

# Install runtime system dependencies (minimal)
RUN apk add --no-cache ca-certificates

# Install pnpm globally
RUN npm install -g pnpm@${PNPM_VERSION}

# Copy from stages
COPY --from=builder /usr/src/app/package.json ./
# Use production node_modules from deps
COPY --from=deps /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/prisma ./prisma

ENV NODE_ENV=production

# Create non-root user and set ownership
RUN adduser -D appuser && chown -R appuser:appuser /usr/src/app
USER appuser

EXPOSE 3002

# Node.js-based healthcheck (no curl needed)
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3002/api/health', (res) => { if (res.statusCode === 200) process.exit(0); process.exit(1); })" || exit 1

CMD ["pnpm", "start"]