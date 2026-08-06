#!/usr/bin/env python3
"""Verify matching engine/model pairs load and crossed pairs reject cleanly."""
from __future__ import annotations

import argparse
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def run(binary: Path, engine: str, model: Path, audio: Path) -> tuple[int, str]:
    command = [str(binary), "--engine", engine, "--model", str(model), "--audio", str(audio), "--language", "en-US", "--pace", "unpaced"]
    result = subprocess.run(command, text=True, capture_output=True, timeout=180)
    return result.returncode, result.stdout


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--binary", type=Path, default=ROOT / "build/talk-to-pi-engine-eval")
    parser.add_argument("--audio", type=Path, default=ROOT / "corpus/normalized/speech.wav")
    args = parser.parse_args()
    nemo = ROOT / "models/nemo-speech/nemotron-3.5-asr-streaming-0.6b.q8_0.gguf"
    parakeet = ROOT / "models/parakeet/nemotron-3.5-asr-streaming-0.6b.parakeet.q8_0.gguf"
    cases = [("nemo", nemo, True), ("parakeet", parakeet, True), ("nemo", parakeet, False), ("parakeet", nemo, False)]
    failed = False
    for engine, model, should_succeed in cases:
        code, output = run(args.binary, engine, model, args.audio)
        succeeded = code == 0
        expected = "matching" if should_succeed else "crossed"
        print(f"{'OK' if succeeded == should_succeed else 'FAIL'} {expected} {engine} {model.name} exit={code}")
        if not succeeded == should_succeed:
            print(output[-1000:])
            failed = True
    raise SystemExit(1 if failed else 0)


if __name__ == "__main__":
    main()
