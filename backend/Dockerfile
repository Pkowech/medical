# syntax=docker/dockerfile:1

ARG NODE_VERSION=22.23.1
ARG PNPM_VERSION=10.32.1
ARG DATABASE_URL=postgresql://postgres:postgres@localhost:5432/medtrack

################################################################────────────────
# Use node image for base image for all stages.
FROM node:${NODE_VERSION}-alpine AS base
ARG DATABASE_URL

ENV DATABASE_URL=${DATABASE_URL}

# Set working directory for all build stages.
WORKDIR /usr/src/app

# Install pnpm.
RUN --mount=type=cache,target=/root/.npm \
    npm install -g pnpm@${PNPM_VERSION}

################################################################────────────────
# Create a stage for installing production dependencies.
FROM base AS deps

# Download dependencies as a separate step to take advantage of Docker's caching.
# Leverage bind mounts to package.json, pnpm-lock.yaml, and pnpm-workspace.yaml.
RUN --mount=type=bind,source=package.json,target=package.json \
    --mount=type=bind,source=pnpm-lock.yaml,target=pnpm-lock.yaml \
    --mount=type=bind,source=pnpm-workspace.yaml,target=pnpm-workspace.yaml \
    --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --prod --frozen-lockfile

################################################################────────────────
# Create a stage for building the application.
FROM deps AS build

# Download additional development dependencies before building.
RUN --mount=type=bind,source=package.json,target=package.json \
    --mount=type=bind,source=pnpm-lock.yaml,target=pnpm-lock.yaml \
    --mount=type=bind,source=pnpm-workspace.yaml,target=pnpm-workspace.yaml \
    --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# Copy the rest of the source files into the image.
COPY . .
RUN pnpm prisma generate
RUN pnpm run build
RUN pnpm prune --prod

################################################################────────────────
# Create a new stage to run the application with minimal runtime dependencies
# where the necessary files are copied from the build stage.
FROM base AS final

# Use production node environment by default.
ENV NODE_ENV=production

# Copy package.json, dependencies, and build output with node user ownership
COPY --chown=node:node package.json .
COPY --chown=node:node --from=build /usr/src/app/node_modules ./node_modules
COPY --chown=node:node --from=build /usr/src/app/dist ./dist

# Run the application as non-root user
USER node

# Expose the port that the application listens on.
EXPOSE 3002

# Run Prisma migrations and start the application with Node directly.
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && node dist/src/main"]
