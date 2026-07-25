# syntax=docker/dockerfile:1

ARG NODE_VERSION=22.23.1
ARG PNPM_VERSION=10.32.1

################################################################
FROM node:${NODE_VERSION}-alpine AS base
WORKDIR /usr/src/app
RUN npm install -g pnpm@${PNPM_VERSION}

################################################################
FROM base AS deps
COPY backend/package.json backend/pnpm-lock.yaml backend/pnpm-workspace.yaml ./
ENV PRISMA_GENERATE_SKIP=true
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --prefer-offline --ignore-scripts

################################################################
FROM deps AS build
COPY protos ./protos
COPY backend ./

RUN pnpm install --frozen-lockfile --ignore-scripts=false

RUN if [ ! -f .env ]; then \
      echo "DATABASE_URL=postgresql://dummy:dummy@localhost:5432/dummy" > .env && \
      echo "DIRECT_URL=postgresql://dummy:dummy@localhost:5432/dummy" >> .env && \
      echo "JWT_SECRET=build-time-dummy-secret-change-in-production" >> .env && \
      echo "JWT_REFRESH_SECRET=build-time-dummy-refresh-change-in-production" >> .env; \
    fi && \
    pnpm prisma generate

RUN pnpm run build

################################################################
FROM base AS prod-deps
COPY backend/package.json backend/pnpm-lock.yaml backend/pnpm-workspace.yaml ./
ENV PRISMA_GENERATE_SKIP=true
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --filter medtrack-hub-backend --prod --frozen-lockfile --ignore-scripts

################################################################
FROM node:${NODE_VERSION}-alpine AS final

ENV NODE_ENV=production
ENV PORT=3002
ENV HOSTNAME=0.0.0.0

WORKDIR /usr/src/app

COPY --from=prod-deps /usr/src/app/node_modules ./node_modules
COPY --from=build /usr/src/app/dist ./dist
COPY --from=build /usr/src/app/prisma ./prisma
COPY --from=build /usr/src/app/package.json ./

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001 && \
    chown -R nestjs:nodejs /usr/src/app

USER nestjs

# Improved CMD - easier to read and less lint noise
CMD ["sh", "-c", "\
  echo 'Running Prisma migrations...' && \
  if [ -n \"$DATABASE_URL\" ]; then \
    ./node_modules/.bin/prisma migrate deploy || echo 'Migration failed or timed out, continuing...'; \
  else \
    echo 'DATABASE_URL not set - skipping migrations'; \
  fi && \
  echo 'Starting NestJS application...' && \
  exec node dist/src/main \
"]