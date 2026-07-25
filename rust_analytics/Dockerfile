# syntax=docker/dockerfile:1

ARG RUST_VERSION=1.96.1
ARG APP_NAME=rust_analytics

################################################################################
# Fallback stage for additional build context 'protos' if not supplied externally.
FROM alpine:3.18 AS proto_context
WORKDIR /protos
RUN --mount=type=bind,from=protos,source=.,target=/tmp/ctx \
    if [ -f /tmp/ctx/analytics.proto ]; then \
      mkdir -p /protos && cp /tmp/ctx/analytics.proto /protos/analytics.proto; \
    elif [ -d /tmp/ctx/protos ]; then \
      mkdir -p /protos && cp -r /tmp/ctx/protos/* /protos/ 2>/dev/null || true; \
    fi

################################################################################
# Build stage
FROM rust:${RUST_VERSION}-alpine AS build
ARG APP_NAME
ARG CARGO_BUILD_JOBS=8
ARG SQLX_OFFLINE=true
WORKDIR /app

# Optimization flags for faster builds
ENV SQLX_OFFLINE=${SQLX_OFFLINE}
ENV CARGO_BUILD_JOBS=${CARGO_BUILD_JOBS}
ENV RUSTFLAGS="-C embed-bitcode=no"

# Install build dependencies
RUN apk add --no-cache clang lld musl-dev git protobuf-dev protoc pkgconfig

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
    fi && \
    find /app/.sqlx -name '*.json' 2>/dev/null | wc -l

RUN --mount=type=bind,from=proto_context,source=/protos,target=/protos \
    --mount=type=cache,target=/app/target/ \
    --mount=type=cache,target=/usr/local/cargo/git/db \
    --mount=type=cache,target=/usr/local/cargo/registry/ \
    SQLX_OFFLINE=true cargo build --locked --release && \
    cp ./target/release/$APP_NAME /bin/server

################################################################################
# Runtime stage
FROM alpine:3.18 AS final

ARG UID=10001
RUN adduser \
    --disabled-password \
    --gecos "" \
    --home "/nonexistent" \
    --shell "/sbin/nologin" \
    --no-create-home \
    --uid "${UID}" \
    appuser

COPY --from=build /bin/server /bin/

USER appuser

EXPOSE 8000

CMD ["/bin/server"]
