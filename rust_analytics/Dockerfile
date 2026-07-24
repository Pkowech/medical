# syntax=docker/dockerfile:1

# Comments are provided throughout this file to help you get started.
# If you need more help, visit the Dockerfile reference guide at
# https://docs.docker.com/go/dockerfile-reference/

# Want to help us make this template better? Share your feedback here: https://forms.gle/ybq9Krt8jtBL3iCk7

ARG RUST_VERSION=1.96.1
ARG APP_NAME=rust_analytics

################################################################################
# Fallback stage for additional build context 'protos' if not supplied externally.
# When --build-context protos=... is passed (e.g. via Docker Compose or CI), BuildKit
# will override this stage with the external build context.
FROM alpine:3.18 AS protos
WORKDIR /protos
RUN --mount=type=bind,source=.,target=/tmp/ctx \
    if [ -d /tmp/ctx/protos ]; then \
      cp -r /tmp/ctx/protos/* /protos/ 2>/dev/null || true; \
    elif [ -d /tmp/ctx/../protos ]; then \
      cp -r /tmp/ctx/../protos/* /protos/ 2>/dev/null || true; \
    fi

################################################################################
# Create a stage for building the application.

FROM rust:${RUST_VERSION}-alpine AS build
ARG APP_NAME
WORKDIR /app

# SQLx macros should use the checked-in offline query cache during container
# builds so the image does not depend on DATABASE_URL being available at build time.
ENV SQLX_OFFLINE=true

# Install host build dependencies.
RUN apk add --no-cache clang lld musl-dev git protobuf-dev protoc

# Copy crate source files dynamically whether build context is repo root or rust_analytics folder
RUN --mount=type=bind,source=.,target=/tmp/ctx \
    mkdir -p /app/src /app/.sqlx && \
    if [ -f /tmp/ctx/Cargo.toml ]; then \
      cp /tmp/ctx/Cargo.toml /tmp/ctx/Cargo.lock /tmp/ctx/build.rs /app/ && \
      cp -r /tmp/ctx/src/* /app/src/ && \
      cp -r /tmp/ctx/.sqlx/* /app/.sqlx/ 2>/dev/null || true; \
    elif [ -f /tmp/ctx/rust_analytics/Cargo.toml ]; then \
      cp /tmp/ctx/rust_analytics/Cargo.toml /tmp/ctx/rust_analytics/Cargo.lock /tmp/ctx/rust_analytics/build.rs /app/ && \
      cp -r /tmp/ctx/rust_analytics/src/* /app/src/ && \
      cp -r /tmp/ctx/rust_analytics/.sqlx/* /app/.sqlx/ 2>/dev/null || true; \
    fi

RUN --mount=type=bind,from=protos,source=.,target=/protos \
    --mount=type=cache,target=/app/target/ \
    --mount=type=cache,target=/usr/local/cargo/git/db \
    --mount=type=cache,target=/usr/local/cargo/registry/ \
    cargo build --locked --release && \
    cp ./target/release/$APP_NAME /bin/server

################################################################################
# Create a new stage for running the application that contains the minimal
# runtime dependencies for the application. This often uses a different base
# image from the build stage where the necessary files are copied from the build
# stage.
#
# The example below uses the alpine image as the foundation for running the app.
# By specifying the "3.18" tag, it will use version 3.18 of alpine. If
# reproducibility is important, consider using a digest
# (e.g., alpine@sha256:664888ac9cfd28068e062c991ebcff4b4c7307dc8dd4df9e728bedde5c449d91).
FROM alpine:3.18 AS final

# Create a non-privileged user that the app will run under.
# See https://docs.docker.com/go/dockerfile-user-best-practices/
ARG UID=10001
COPY protos /protos

RUN --mount=type=cache,target=/app/target/ \
    --mount=type=cache,target=/usr/local/cargo/git/db \
    --mount=type=cache,target=/usr/local/cargo/registry/ \
    cargo build --locked --release && \
    cp ./target/release/$APP_NAME /bin/server
    
USER appuser

# Copy the executable from the "build" stage.
COPY --from=build /bin/server /bin/

# Expose the port that the application listens on.
EXPOSE 8000

# What the container should run when it is started.
CMD ["/bin/server"]
