#!/bin/bash
set -euo pipefail

export ENABLE_GRPC=true
export ANALYTICS_GRPC_URL=127.0.0.1:50051
export RUST_ANALYTICS_GRPC_URL=127.0.0.1:50051

/usr/local/bin/rust_analytics &
rust_pid=$!
backend_pid=

stop_services() {
  trap - TERM INT
  if [[ -n "$backend_pid" ]]; then
    kill "$backend_pid" 2>/dev/null || true
  fi
  kill "$rust_pid" 2>/dev/null || true
  if [[ -n "$backend_pid" ]]; then
    wait "$backend_pid" 2>/dev/null || true
  fi
  wait "$rust_pid" 2>/dev/null || true
}

trap stop_services TERM INT

for attempt in {1..60}; do
  if ! kill -0 "$rust_pid" 2>/dev/null; then
    wait "$rust_pid"
    exit 1
  fi
  if (echo > /dev/tcp/127.0.0.1/50051) 2>/dev/null; then
    break
  fi
  if [[ "$attempt" -eq 60 ]]; then
    echo "Rust analytics gRPC listener did not become ready on 127.0.0.1:50051" >&2
    exit 1
  fi
  sleep 1
done

node /usr/src/app/dist/main.js &
backend_pid=$!

set +e
wait -n "$rust_pid" "$backend_pid"
status=$?
set -e

stop_services
exit "$status"
