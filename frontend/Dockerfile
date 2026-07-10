# ARG NODE_VERSION=22.9.0
ARG NODE_VERSION=22.9.0
ARG PNPM_VERSION=9.12.2

# Base image
FROM node:${NODE_VERSION}-alpine AS base
WORKDIR /usr/src/app

# Install pnpm globally with caching
RUN --mount=type=cache,target=/root/.npm \
    npm install -g pnpm@${PNPM_VERSION}

# Install production dependencies only
FROM base AS deps
RUN --mount=type=bind,source=package.json,target=package.json \
    --mount=type=bind,source=pnpm-lock.yaml,target=pnpm-lock.yaml \
    --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --prod --no-frozen-lockfile

# Build stage (full dependencies for build)
FROM base AS build
RUN --mount=type=bind,source=package.json,target=package.json \
    --mount=type=bind,source=pnpm-lock.yaml,target=pnpm-lock.yaml \
    --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --no-frozen-lockfile
COPY . .
RUN pnpm run build

# Final production stage
FROM base AS final
ENV NODE_ENV=production
USER node
# Copy production node_modules from deps stage
COPY --from=deps --chown=node:node /usr/src/app/node_modules ./node_modules
# Copy package files and build artifacts
COPY --from=build --chown=node:node /usr/src/app/package.json ./package.json
COPY --from=build --chown=node:node /usr/src/app/.next ./.next
COPY --from=build --chown=node:node /usr/src/app/public ./public
EXPOSE 3000
CMD ["pnpm", "start"]