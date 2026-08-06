#!/usr/bin/env python3
"""Verify local model artifacts against the evaluation manifest."""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path


def digest(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda: f.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", type=Path, default=Path(__file__).resolve().parents[1] / "models/manifest.json")
    args = parser.parse_args()
    root = args.manifest.parent
    manifest = json.loads(args.manifest.read_text())
    checks = [
        (root / "source" / manifest["source"]["nemo"]["filename"], manifest["source"]["nemo"]),
        (root / "nemo-speech" / manifest["source"]["nvidiaQ8"]["filename"], manifest["source"]["nvidiaQ8"]),
        (root / "parakeet" / manifest["source"]["parakeetQ8"]["filename"], manifest["source"]["parakeetQ8"]),
    ]
    failed = False
    for path, expected in checks:
        if not path.is_file():
            print(f"MISSING {path}")
            failed = True
            continue
        actual_size = path.stat().st_size
        actual_hash = digest(path)
        ok = actual_size == expected["sizeBytes"] and actual_hash == expected["sha256"]
        print(f"{'OK' if ok else 'FAIL'} {path} size={actual_size} sha256={actual_hash}")
        failed |= not ok
    raise SystemExit(1 if failed else 0)


if __name__ == "__main__":
    main()
