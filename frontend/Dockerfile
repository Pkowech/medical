ARG NODE_VERSION=22.9.0
ARG PNPM_VERSION=9.12.2

# Base image
FROM node:${NODE_VERSION}-alpine AS base
WORKDIR /usr/src/app

RUN npm install -g pnpm@${PNPM_VERSION}

# Install dependencies with full build tools (dev + prod)
FROM base AS builder
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --no-frozen-lockfile
COPY . .
RUN pnpm run build

# Prune to production-only deps
FROM base AS prod-deps
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --prod --no-frozen-lockfile

# Final production stage — minimal base
FROM node:${NODE_VERSION}-alpine AS final
WORKDIR /usr/src/app

ENV NODE_ENV=production
USER node

COPY --from=prod-deps --chown=node:node /usr/src/app/node_modules ./node_modules
COPY --from=builder --chown=node:node /usr/src/app/package.json ./package.json
COPY --from=builder --chown=node:node /usr/src/app/.next ./.next
COPY --from=builder --chown=node:node /usr/src/app/public ./public

EXPOSE 3000

CMD ["node_modules/.bin/next", "start"]
