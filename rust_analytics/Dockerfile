# Builder stage
FROM rust:1.78-bullseye AS builder

# Install build dependencies (minimal)
RUN apt-get update && apt-get install -y --no-install-recommends \
    protobuf-compiler \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy project files (cache Cargo.toml first)
COPY Cargo.toml Cargo.lock ./
COPY proto ./proto
COPY build.rs ./
COPY src ./src

# Build release binary
RUN cargo build --release

# Strip for size (optional; remove if causing issues)
RUN strip target/release/rust_analytics || true

# Final stage

FROM debian:bookworm-slim AS final

# Install runtime dependencies (add more if needed, e.g., libpq for Postgres)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates wget libgcc1 \
    && rm -rf /var/lib/apt/lists/*

# Copy binary
COPY --from=builder /app/target/release/rust_analytics /usr/local/bin/rust_analytics

# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup \
        && chown appuser:appgroup /usr/local/bin/rust_analytics

USER appuser

EXPOSE 8000 50051

# Healthcheck calling the HTTP /health endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD wget -qO- http://127.0.0.1:8000/health || exit 1

ENTRYPOINT ["/usr/local/bin/rust_analytics"]