#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NEMO_DIR="$ROOT_DIR/native/vendor/NeMo-Speech.cpp"
PATCH_FILE="$ROOT_DIR/native/patches/nemo-speech-embed.patch"

# Existing Windows checkouts may predate the repository's LF attributes. Feed
# git apply a normalized copy so CRLF patch context cannot break configuration.
NORMALIZED_PATCH=""
cleanup() {
  [[ -z "$NORMALIZED_PATCH" ]] || rm -f "$NORMALIZED_PATCH"
}
trap cleanup EXIT
if grep -q $'\r$' "$PATCH_FILE"; then
  NORMALIZED_PATCH="$(mktemp)"
  sed $'s/\r$//' "$PATCH_FILE" > "$NORMALIZED_PATCH"
  PATCH_FILE="$NORMALIZED_PATCH"
fi

if git -C "$NEMO_DIR" apply --check "$PATCH_FILE" 2>/dev/null; then
  git -C "$NEMO_DIR" apply "$PATCH_FILE"
elif git -C "$NEMO_DIR" apply --reverse --check "$PATCH_FILE" 2>/dev/null; then
  exit 0
else
  echo "NeMo-Speech.cpp embedding patch does not apply to the pinned upstream revision." >&2
  git -C "$NEMO_DIR" apply --check --verbose "$PATCH_FILE" >&2 || true
  exit 1
fi
