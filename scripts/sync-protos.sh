#!/usr/bin/env sh
# Copy shared protos into service build contexts so each service can build
# with its own (small) build context.

set -e

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PROTO_SRC="$ROOT_DIR/protos"

if [ ! -d "$PROTO_SRC" ]; then
  echo "No protos directory found at $PROTO_SRC"
  exit 1
fi

for svc in rust_analytics backend; do
  dest="$ROOT_DIR/$svc/protos"
  echo "Syncing protos -> $dest"
  rm -rf "$dest"
  mkdir -p "$dest"
  cp -a "$PROTO_SRC/"* "$dest/" || true
done

echo "Protos synced to service folders."
