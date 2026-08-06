#!/usr/bin/env python3
"""Normalize audio to the common 16 kHz mono float32 WAV format."""
from __future__ import annotations

import argparse
import shutil
import subprocess
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    if shutil.which("ffmpeg") is None: raise SystemExit("ffmpeg is required")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(["ffmpeg", "-nostdin", "-y", "-v", "error", "-i", str(args.input), "-ac", "1", "-ar", "16000", "-c:a", "pcm_f32le", str(args.output)], check=True)


if __name__ == "__main__":
    main()
