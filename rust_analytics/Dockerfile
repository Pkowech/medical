# syntax=docker/dockerfile:1

ARG RUST_VERSION=1.96.1
ARG APP_NAME=rust_analytics

################################################################################
# Stage for 'protos' build context.
# Copying directly from the local workspace avoids Render/BuildKit attempting 
# to pull an external image named `protos:latest`.
FROM alpine:3.18 AS proto_context
WORKDIR /protos
COPY protos/ /protos/

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

# Copy the crate into a temporary path and assemble /app deterministically.
# When building with the service directory as the build context this will copy
# the crate files. When building from repo root a different path may be used.
COPY . /tmp/rust_analytics
RUN mkdir -p /app/src /app/.sqlx && \
    cp /tmp/rust_analytics/Cargo.toml /tmp/rust_analytics/Cargo.lock /tmp/rust_analytics/build.rs /app/ 2>/dev/null || true; \
    cp -r /tmp/rust_analytics/src/* /app/src/ 2>/dev/null || true; \
    cp -r /tmp/rust_analytics/.sqlx/* /app/.sqlx/ 2>/dev/null || true; \
    find /app/.sqlx -name '*.json' 2>/dev/null | wc -l

RUN --mount=type=bind,from=proto_context,source=/protos,target=/protos \
    --mount=type=cache,target=/app/target/ \
    --mount=type=cache,target=/usr/local/cargo/git/db \
    --mount=type=cache,target=/usr/local/cargo/registry/ \
    SQLX_OFFLINE=true cargo build --locked --release || SQLX_OFFLINE=true cargo build --release && \
    # strip the binary to reduce image size when possible
    if command -v strip >/dev/null 2>&1; then strip ./target/release/$APP_NAME || true; fi && \
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