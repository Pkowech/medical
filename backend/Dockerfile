# syntax=docker/dockerfile:1

ARG NODE_VERSION=22.23.1
ARG PNPM_VERSION=10.32.1
ARG DATABASE_URL="postgresql://medtrack-db_owner:npg_lj1B2IbncYdz@ep-fancy-star-a69qzo1x-pooler.us-west-2.aws.neon.tech/medtrack-db?uselibpqcompat=true&sslmode=require&channel_binding=require"

################################################################────────────────
# Use node image for base image for all stages.
FROM node:${NODE_VERSION}-alpine AS base
ARG DATABASE_URL

ENV DATABASE_URL=${DATABASE_URL}
ENV DIRECT_URL=${DATABASE_URL}

# Set working directory for all build stages.
WORKDIR /usr/src/app

# Install pnpm.
RUN --mount=type=cache,target=/root/.npm \
    npm install -g pnpm@${PNPM_VERSION}

################################################################────────────────
# Create a stage for installing production dependencies.
FROM base AS deps

# Copy only the manifest files first so Docker can cache dependency resolution
# independently from the application source.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --prod --frozen-lockfile --prefer-offline

################################################################────────────────
# Create a stage for building the application.
FROM deps AS build

# Install the full dev dependency set needed for compilation and generation.
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --prefer-offline

# Copy the rest of the source files into the image.
COPY . .
RUN if [ ! -f .env ] && [ -n "$DATABASE_URL" ]; then printf 'DIRECT_URL=%s\n' "$DATABASE_URL" > .env; fi
RUN pnpm prisma generate
RUN pnpm run build
RUN pnpm prune --prod

################################################################────────────────
# Create a new stage to run the application with minimal runtime dependencies
# where the necessary files are copied from the build stage.
FROM node:${NODE_VERSION}-alpine AS final
ARG DATABASE_URL

ENV DATABASE_URL=${DATABASE_URL}
ENV DIRECT_URL=${DATABASE_URL}
ENV NODE_ENV=production
ENV PORT=3002
ENV HOSTNAME=0.0.0.0

WORKDIR /usr/src/app

# Copy package.json, dependencies, build output, and Prisma schema/config
# with node user ownership
COPY --chown=node:node package.json .
COPY --chown=node:node pnpm-lock.yaml .
COPY --chown=node:node --from=build /usr/src/app/node_modules ./node_modules
COPY --chown=node:node --from=build /usr/src/app/dist ./dist
COPY --chown=node:node --from=build /usr/src/app/prisma ./prisma
COPY --chown=node:node --from=build /usr/src/app/prisma.config.ts ./prisma.config.ts

# Ensure the node user has full ownership and write permissions
RUN chown -R node:node /usr/src/app && chmod -R u+w /usr/src/app

# Run the application as non-root user
USER node

# Expose the port that the application listens on.
EXPOSE 3002

# Healthcheck to monitor application status
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3002/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Run Prisma migrations and start the application with Node directly.
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && node dist/src/main"]