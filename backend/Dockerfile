# syntax=docker/dockerfile:1

# Comments are provided throughout this file to help you get started.
# If you need more help, visit the Dockerfile reference guide at
# https://docs.docker.com/go/dockerfile-reference/

# Want to help us make this template better? Share your feedback here: https://forms.gle/ybq9Krt8jtBL3iCk7

ARG NODE_VERSION=22.23.1
ARG PNPM_VERSION=10.32.1
ARG DATABASE_URL=postgresql://postgres:postgres@localhost:5432/medtrack

################################################################################
# Use node image for base image for all stages.
FROM node:${NODE_VERSION}-alpine AS base
ARG DATABASE_URL

ENV DATABASE_URL=${DATABASE_URL}

# Set working directory for all build stages.
WORKDIR /usr/src/app

# Install pnpm.
RUN --mount=type=cache,target=/root/.npm \
    npm install -g pnpm@${PNPM_VERSION}

################################################################################
# Create a stage for installing production dependecies.
FROM base AS deps

# Download dependencies as a separate step to take advantage of Docker's caching.
# Leverage a cache mount to /root/.local/share/pnpm/store to speed up subsequent builds.
# Copy package.json, pnpm-lock.yaml, and pnpm-workspace.yaml from the backend folder so installs are reproducible.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml* ./
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --prod

################################################################################
# Create a stage for building the application.
FROM deps AS build

# Download additional development dependencies before building, as some projects require
# "devDependencies" to be installed to build. Copy lockfile here too so build is reproducible.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml* ./
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install

# Copy the rest of the source files into the image.
COPY . .
RUN pnpm prisma generate
RUN pnpm run build
RUN pnpm prune --prod
# Remove cache files inside node_modules to keep final image small
RUN rm -rf ./node_modules/.cache || true

################################################################################
# Create a new stage to run the application with minimal runtime dependencies
# where the necessary files are copied from the build stage.
FROM base AS final

# Use production node environment by default.
ENV NODE_ENV=production

# Ensure app directory permissions before copying
RUN mkdir -p /usr/src/app && chown node:node /usr/src/app

# Copy package.json and clean production node_modules from deps stage
COPY --chown=node:node package.json .
COPY --chown=node:node --from=deps /usr/src/app/node_modules ./node_modules
COPY --chown=node:node --from=build /usr/src/app/dist ./dist

# Run the application as a non-root user.
USER node

# Expose the port that the application listens on.
EXPOSE 3002

# Run Prisma migrations and start the application.
CMD ["sh", "-c", "npx prisma migrate deploy && pnpm start"]
