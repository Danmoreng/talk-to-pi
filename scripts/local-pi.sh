#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNTIME_PATH="${TALK_TO_PI_RUNTIME_PATH:-$ROOT_DIR/native/build/talk-to-pi-runtime}"

if [[ ! -x "$RUNTIME_PATH" ]]; then
  echo "Talk-to-Pi runtime not found or not executable: $RUNTIME_PATH" >&2
  echo "Run: npm run native:build" >&2
  exit 1
fi
exec env \
  TALK_TO_PI_RUNTIME_PATH="$RUNTIME_PATH" \
  TALK_TO_PI_MODEL_PATH="" \
  pi --no-extensions --extension "$ROOT_DIR/dist/index.js" "$@"
