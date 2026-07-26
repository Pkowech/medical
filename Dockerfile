# syntax=docker/dockerfile:1

ARG NODE_VERSION=22.23.1
ARG PNPM_VERSION=11.17.0

FROM node:${NODE_VERSION}-alpine AS base
WORKDIR /usr/src/app
RUN npm install -g pnpm@${PNPM_VERSION} --no-fund --no-audit && npm cache clean --force

FROM base AS deps
COPY backend/package.json backend/pnpm-lock.yaml backend/pnpm-workspace.yaml ./
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --prefer-offline --ignore-scripts

FROM deps AS build
COPY protos ./protos
COPY backend ./

RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    rm -rf node_modules && pnpm install --frozen-lockfile --ignore-scripts=false

RUN echo "DATABASE_URL=postgresql://dummy:[REDACTED]@localhost:5432/dummy" > .env && \
    echo "DIRECT_URL=postgresql://dummy:[REDACTED]@localhost:5432/dummy" >> .env && \
    echo "JWT_SECRET=build-time-dummy" >> .env && \
    echo "JWT_REFRESH_SECRET=build-time-dummy-refresh" >> .env && \
    pnpm prisma generate

RUN find node_modules/@prisma/client -type f \
      \( -iname "query_compiler_*" -o -iname "*.wasm" \) \
      ! -iname "*postgresql*" -delete 2>/dev/null || true && \
    find node_modules/@prisma/client -type f -iname "*.map" -delete 2>/dev/null || true

RUN mkdir -p node_modules/.prisma/client node_modules/@prisma/client && \
    find node_modules/.pnpm -name "libquery_engine*linux-musl*" -type f \
      -exec cp {} node_modules/.prisma/client/ \; 2>/dev/null || true && \
    find node_modules/.pnpm -path "*/.prisma/client/*" -type f \
      -exec cp {} node_modules/.prisma/client/ \; 2>/dev/null || true && \
    find node_modules/.pnpm -path "*/@prisma/client/*" -type f \
      -exec cp {} node_modules/@prisma/client/ \; 2>/dev/null || true

RUN pnpm run build && find dist -name "*.js.map" -delete 2>/dev/null || true

RUN rm -rf node_modules/@types node_modules/typescript node_modules/eslint* 2>/dev/null || true && \
    find node_modules -type d \( -name build -o -name docs -o -name test -o -name src -o -name .github \) -exec rm -rf {} + 2>/dev/null || true

FROM node:${NODE_VERSION}-alpine AS final
RUN apk add --no-cache ca-certificates tzdata wget && npm cache clean --force

ENV NODE_ENV=production PORT=3002 HOSTNAME=0.0.0.0
WORKDIR /usr/src/app
RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001

COPY --chown=nestjs:nodejs --from=build /usr/src/app/dist ./dist
COPY --chown=nestjs:nodejs --from=build /usr/src/app/node_modules ./node_modules
COPY --chown=nestjs:nodejs --from=build /usr/src/app/prisma/schema.prisma ./prisma/
COPY --chown=nestjs:nodejs --from=build /usr/src/app/package.json ./
COPY --chown=nestjs:nodejs --from=build /usr/src/app/protos /usr/src/protos

USER nestjs
EXPOSE 3002
CMD ["node", "dist/src/main.js"]
