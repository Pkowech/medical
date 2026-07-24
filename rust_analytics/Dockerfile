# syntax=docker/dockerfile:1

ARG RUST_VERSION=1.96.1
ARG APP_NAME=rust_analytics

################################################################################
# Fallback stage for additional build context 'protos' if not supplied externally.
FROM alpine:3.18 AS protos
WORKDIR /protos
RUN --mount=type=bind,source=.,target=/tmp/ctx \
    if [ -d /tmp/ctx/protos ]; then \
      cp -r /tmp/ctx/protos/* /protos/ 2>/dev/null || true; \
    elif [ -d /tmp/ctx/../protos ]; then \
      cp -r /tmp/ctx/../protos/* /protos/ 2>/dev/null || true; \
    fi

################################################################################
# Build stage
FROM rust:${RUST_VERSION}-alpine AS build
ARG APP_NAME
WORKDIR /app

# Optimization flags for faster builds
ENV SQLX_OFFLINE=true
ENV CARGO_BUILD_JOBS=4
ENV RUSTFLAGS="-C embed-bitcode=no"

# Install build dependencies
RUN apk add --no-cache clang lld musl-dev git protobuf-dev protoc

# Copy crate files with better layer caching
RUN --mount=type=bind,source=.,target=/tmp/ctx \
    mkdir -p /app/src /app/.sqlx && \
    if [ -f /tmp/ctx/Cargo.toml ]; then \
      cp /tmp/ctx/Cargo.toml /tmp/ctx/Cargo.lock /tmp/ctx/build.rs /app/ 2>/dev/null || true; \
      cp -r /tmp/ctx/src/* /app/src/ 2>/dev/null || true; \
      cp -r /tmp/ctx/.sqlx/* /app/.sqlx/ 2>/dev/null || true; \
    elif [ -f /tmp/ctx/rust_analytics/Cargo.toml ]; then \
      cp /tmp/ctx/rust_analytics/Cargo.toml /tmp/ctx/rust_analytics/Cargo.lock /tmp/ctx/rust_analytics/build.rs /app/ 2>/dev/null || true; \
      cp -r /tmp/ctx/rust_analytics/src/* /app/src/ 2>/dev/null || true; \
      cp -r /tmp/ctx/rust_analytics/.sqlx/* /app/.sqlx/ 2>/dev/null || true; \
    fi

# Build with mount caches
RUN --mount=type=bind,from=protos,source=.,target=/protos \
    --mount=type=cache,target=/app/target/ \
    --mount=type=cache,target=/usr/local/cargo/git/db \
    --mount=type=cache,target=/usr/local/cargo/registry/ \
    cargo build --locked --release && \
    cp ./target/release/$APP_NAME /bin/server

################################################################################
# Runtime stage
FROM alpine:3.18 AS final

ARG UID=10001
RUN adduser -D -u $UID appuser

COPY --from=build /bin/server /bin/

USER appuser

EXPOSE 8000

CMD ["/bin/server"]
