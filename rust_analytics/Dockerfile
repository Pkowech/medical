# syntax=docker/dockerfile:1

ARG RUST_VERSION=1.96.1
ARG APP_NAME=rust_analytics

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

COPY protos /protos

RUN --mount=type=cache,target=/app/target/ \
    --mount=type=cache,target=/usr/local/cargo/git/db \
    --mount=type=cache,target=/usr/local/cargo/registry/ \
    cargo build --locked --release && \
    cp ./target/release/$APP_NAME /bin/server

################################################################################
# Create a new stage for running the application that contains the minimal
# runtime dependencies for the application.

FROM alpine:3.18 AS final

# Create a non-privileged user that the app will run under.
ARG UID=10001
RUN adduser \
    --disabled-password \
    --gecos "" \
    --home "/nonexistent" \
    --shell "/sbin/nologin" \
    --no-create-home \
    --uid "${UID}" \
    appuser
USER appuser

# Copy the executable from the "build" stage.
COPY --from=build /bin/server /bin/

# Expose the port that the application listens on.
EXPOSE 8000

# What the container should run when it is started.
CMD ["/bin/server"]
