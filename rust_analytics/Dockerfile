# syntax=docker/dockerfile:1

ARG RUST_VERSION=1.96.1
ARG APP_NAME=rust_analytics

################################################################################
# Stage 1: 'protos' build context
################################################################################
FROM alpine:3.18 AS proto_context
WORKDIR /protos
COPY protos/ /protos/

################################################################################
# Stage 2: Build stage
################################################################################
FROM rust:${RUST_VERSION}-alpine AS build
ARG APP_NAME
ARG CARGO_BUILD_JOBS=8
ARG SQLX_OFFLINE=true
WORKDIR /app

# Optimization flags for faster builds
ENV SQLX_OFFLINE=${SQLX_OFFLINE}
ENV CARGO_BUILD_JOBS=${CARGO_BUILD_JOBS}
ENV RUSTFLAGS="-C embed-bitcode=no"

# Install build dependencies (Added openssl-dev for native-tls crate support)
RUN apk add --no-cache clang lld musl-dev git protobuf-dev protoc pkgconfig openssl-dev

# Copy rust_analytics files into /app
COPY rust_analytics/ /app/

# Verify Cargo.toml arrived safely before running cargo
RUN test -f /app/Cargo.toml || (echo "ERROR: Cargo.toml not found in /app!" && exit 1)

# Debug print SQLX files if present
RUN find /app/.sqlx -name '*.json' 2>/dev/null | wc -l || true

RUN --mount=type=bind,from=proto_context,source=/protos,target=/protos \
    --mount=type=cache,target=/app/target/ \
    --mount=type=cache,target=/usr/local/cargo/git/db \
    --mount=type=cache,target=/usr/local/cargo/registry/ \
    SQLX_OFFLINE=true cargo build --locked --release || SQLX_OFFLINE=true cargo build --release && \
    # Strip the binary to reduce final image size
    if command -v strip >/dev/null 2>&1; then strip ./target/release/$APP_NAME || true; fi && \
    # Copy to standard Linux binary directory
    cp ./target/release/$APP_NAME /usr/local/bin/rust_analytics

################################################################################
# Stage 3: Runtime stage
################################################################################
FROM alpine:3.18 AS final

# 1. Install critical runtime libraries to prevent Render Exit 128 crashes
RUN apk add --no-cache \
    libgcc \
    libstdc++ \
    libssl3 \
    ca-certificates \
    tzdata

ARG UID=10001
RUN adduser \
    --disabled-password \
    --gecos "" \
    --home "/nonexistent" \
    --shell "/sbin/nologin" \
    --no-create-home \
    --uid "${UID}" \
    appuser

# 2. Copy binary to standard path AND create a symlink for legacy /bin/server fallbacks
COPY --from=build /usr/local/bin/rust_analytics /usr/local/bin/rust_analytics
RUN ln -s /usr/local/bin/rust_analytics /bin/server

USER appuser

# Render injects $PORT dynamically, but 8000 sets a clean default fallback
EXPOSE 8000

# Execute using the standard path expected by your docker-compose healthchecks
CMD ["/usr/local/bin/rust_analytics"]