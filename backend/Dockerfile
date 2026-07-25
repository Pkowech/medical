# syntax=docker/dockerfile:1

ARG NODE_VERSION=22.23.1
ARG PNPM_VERSION=10.32.1

################################################################────────────────
FROM node:${NODE_VERSION}-alpine AS base
WORKDIR /usr/src/app
RUN --mount=type=cache,target=/root/.npm \
    npm install -g pnpm@${PNPM_VERSION}

################################################################────────────────
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --prod --frozen-lockfile --prefer-offline

################################################################────────────────
FROM deps AS build
ARG DATABASE_URL

COPY . .

# DATABASE_URL used transiently for `prisma generate` schema introspection
# only — never persisted as ENV, so it never lands in the final image.
RUN if [ ! -f .env ] && [ -n "$DATABASE_URL" ]; then printf 'DIRECT_URL=%s\n' "$DATABASE_URL" > .env; fi
RUN pnpm prisma generate
RUN pnpm run build
RUN pnpm --filter <backend-package-name> deploy --prod /prod

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

CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && node dist/src/main"]