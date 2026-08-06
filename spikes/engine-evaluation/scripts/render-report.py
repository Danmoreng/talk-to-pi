#!/usr/bin/env python3
"""Render a compact Markdown comparison from result JSON files."""
from __future__ import annotations

import argparse
import json
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--results", type=Path, default=Path("results"))
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    rows = []
    for path in sorted(args.results.glob("*.json")):
        if path.name == "summary.json": continue
        rows.append(json.loads(path.read_text()))
    lines = ["# Engine Evaluation Summary", "", f"Runs: {len(rows)}", "", "| Engine | Audio | Status | WER | CER | TTFH ms | Stop→final ms | Revision ratio |", "|---|---|---|---:|---:|---:|---:|---:|"]
    for row in rows:
        metrics = row.get("metrics", {})
        accuracy = metrics.get("accuracy", {})
        lines.append("| {engine} | {audio} | {status} | {wer} | {cer} | {ttfh} | {stop} | {revision} |".format(
            engine=row.get("engine", {}).get("name", "?"),
            audio=row.get("audio", {}).get("id", "?"),
            status=row.get("status", "?"),
            wer=f"{accuracy.get('wer', 0):.3f}" if "wer" in accuracy else "—",
            cer=f"{accuracy.get('cer', 0):.3f}" if "cer" in accuracy else "—",
            ttfh=f"{metrics.get('ttfhMs', 0):.1f}" if metrics.get('ttfhMs') is not None else "—",
            stop=f"{metrics.get('stopToFinalMs', 0):.1f}" if metrics.get('stopToFinalMs') is not None else "—",
            revision=f"{metrics.get('revisionRatio', 0):.3f}",
        ))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text("\n".join(lines) + "\n")


if __name__ == "__main__":
    main()
