#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NEMO_DIR="$ROOT_DIR/native/vendor/NeMo-Speech.cpp"
PATCH_FILE="$ROOT_DIR/native/patches/nemo-speech-embed.patch"

if git -C "$NEMO_DIR" apply --check "$PATCH_FILE"; then
  git -C "$NEMO_DIR" apply "$PATCH_FILE"
elif git -C "$NEMO_DIR" apply --reverse --check "$PATCH_FILE"; then
  exit 0
else
  echo "NeMo-Speech.cpp embedding patch does not apply to the pinned upstream revision." >&2
  exit 1
fi
