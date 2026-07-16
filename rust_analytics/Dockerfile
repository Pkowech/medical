# Builder stage
FROM rust:1.72-bookworm AS builder

# Install build dependencies (minimal)
RUN apt-get update && apt-get install -y --no-install-recommends \
    protobuf-compiler \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy project files (cache Cargo.toml first)
COPY rust_analytics/Cargo.toml rust_analytics/Cargo.lock ./
COPY protos ./proto
COPY rust_analytics/build.rs ./
COPY rust_analytics/src ./src

# Build release binary
RUN cargo build --release

# Strip for size
RUN strip target/release/rust_analytics || true

# Final stage — distroless "cc" image instead of debian:bookworm-slim.
# distroless/cc ships only glibc + libssl + libstdc++ + ca-certificates —
# no apt, no shell, no package manager, no wget. This is the single biggest
# size lever available here: debian:bookworm-slim + your installed packages
# runs 70-90MB before your binary is even added; distroless/cc starts
# around 20-25MB. Your binary is glibc-linked (built on Debian bullseye),
# so it's compatible without any changes to the Rust build itself.
#
# Tradeoff: no shell means you can't `docker exec -it ... sh` into this
# container to debug interactively. If that's something you rely on day to
# day, tell me and I'll give you the debian:bookworm-slim variant instead
# (still fixed/optimized, just larger).
FROM gcr.io/distroless/cc-debian12:nonroot AS final

# Copy binary
COPY --from=builder /app/target/release/rust_analytics /usr/local/bin/rust_analytics

# distroless ships a built-in non-root user (nonroot:nonroot, uid 65532) —
# no addgroup/adduser needed (and no shell to run them in anyway). The
# original Dockerfile used Alpine's `-S` flag for adduser/addgroup on a
# Debian base, which would have failed the build outright: Debian's
# adduser/addgroup don't support `-S`.
USER nonroot:nonroot

EXPOSE 8000 50051

# Healthcheck now matches what docker-compose.yml actually expects (the
# binary's own --health flag), and uses exec form so it doesn't need a shell.
# The previous version installed wget just to hit an HTTP endpoint here,
# duplicating logic the binary already implements — removed that dependency
# entirely.
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD ["/usr/local/bin/rust_analytics", "--health"]

ENTRYPOINT ["/usr/local/bin/rust_analytics"]