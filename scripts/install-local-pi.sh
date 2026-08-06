#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PI_BIN="${PI_BIN:-pi}"
MODEL_PATH="${TALK_TO_PI_MODEL_PATH:-${XDG_DATA_HOME:-$HOME/.local/share}/talk-to-pi/models/nemotron-3.5-asr-streaming-0.6b-q8_0-parakeet.gguf}"
RUNTIME_PATH="${TALK_TO_PI_RUNTIME_PATH:-$ROOT_DIR/native/build/talk-to-pi-runtime}"

if ! command -v "$PI_BIN" >/dev/null 2>&1; then
  echo "Pi executable not found: $PI_BIN" >&2
  exit 1
fi

echo "Building Talk-to-Pi..."
npm --prefix "$ROOT_DIR" run build
npm --prefix "$ROOT_DIR" run native:build

echo "Installing local Pi package globally from $ROOT_DIR..."
"$PI_BIN" install "$ROOT_DIR"

echo
echo "Talk-to-Pi is now available to normal Pi sessions."
echo "Add these exports to your shell profile for the local runtime/model:"
printf '  export TALK_TO_PI_RUNTIME_PATH=%q\n' "$RUNTIME_PATH"
printf '  export TALK_TO_PI_MODEL_PATH=%q\n' "$MODEL_PATH"
echo
echo "Then start Pi normally with: pi"
if [[ ! -x "$RUNTIME_PATH" ]]; then
  echo "Warning: runtime is not executable yet: $RUNTIME_PATH" >&2
fi
if [[ ! -f "$MODEL_PATH" ]]; then
  echo "Warning: model was not found yet: $MODEL_PATH" >&2
fi
