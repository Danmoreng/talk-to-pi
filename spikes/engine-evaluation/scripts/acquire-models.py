#!/usr/bin/env python3
"""Print the pinned model acquisition commands and verify local artifacts.

Downloading is intentionally explicit so large model files are never fetched
implicitly by a benchmark run.
"""
from __future__ import annotations

import argparse
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--show-command", action="store_true")
    args = parser.parse_args()
    if args.show_command:
        print("hf download nvidia/nemotron-3.5-asr-streaming-0.6b \\")
        print("  nemotron-3.5-asr-streaming-0.6b.nemo \\")
        print("  nemotron-3.5-asr-streaming-0.6b.q8_0.gguf \\")
        print("  --revision 1c8deaecc64b91f034d73e08dd8b64625eb3395d \\")
        print("  --local-dir spikes/engine-evaluation/models/source")
    else:
        print(Path(__file__).resolve().parents[1] / "models/manifest.json")


if __name__ == "__main__":
    main()
