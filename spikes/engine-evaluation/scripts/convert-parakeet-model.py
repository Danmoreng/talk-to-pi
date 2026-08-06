#!/usr/bin/env python3
"""Recreate the parakeet.cpp Q8_0 artifact from the pinned local .nemo file."""
from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_MODEL = ROOT / "models/source/nemotron-3.5-asr-streaming-0.6b.nemo"
DEFAULT_OUTPUT = ROOT / "models/parakeet/nemotron-3.5-asr-streaming-0.6b.parakeet.q8_0.gguf"
CONVERTER = ROOT.parent.parent / "native/vendor/parakeet.cpp/scripts/convert_parakeet_to_gguf.py"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", type=Path, default=DEFAULT_MODEL)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--dtype", choices=["f32", "f16", "q8_0"], default="q8_0")
    args = parser.parse_args()
    if not args.model.exists(): raise SystemExit(f"model not found: {args.model}")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    command = [sys.executable, str(CONVERTER), "--model", str(args.model), "--dtype", args.dtype, "--output", str(args.output)]
    print("+", " ".join(command), flush=True)
    subprocess.run(command, check=True)


if __name__ == "__main__":
    main()
