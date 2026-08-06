#!/usr/bin/env python3
"""Derive product-relevant streaming metrics from runner JSONL events."""
from __future__ import annotations

import argparse
import difflib
import json
from pathlib import Path


def load_events(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text().splitlines() if line.strip()]


def changed_chars(previous: str, current: str) -> int:
    matcher = difflib.SequenceMatcher(a=previous, b=current, autojunk=False)
    return sum(block.size for block in matcher.get_matching_blocks()[:-1])


def analyze(events: list[dict]) -> dict:
    hypotheses = [e for e in events if e.get("event") == "hypothesis" and e.get("text")]
    first = hypotheses[0] if hypotheses else None
    final_event = next((e for e in reversed(events) if e.get("event") == "final_result"), None)
    texts = [str(e.get("text", "")) for e in hypotheses]
    churn = 0
    revisions = 0
    for previous, current in zip(texts, texts[1:]):
        if previous != current:
            revisions += 1
            churn += len(previous) + len(current) - 2 * changed_chars(previous, current)
    stable = [e for e in hypotheses if e.get("engineStable")]
    first_stable_word_ms = None
    if stable:
        first_stable_word_ms = stable[0].get("emittedAtMs")
    final_text = str((final_event or {}).get("text", texts[-1] if texts else ""))
    return {
        "ttfhMs": first.get("emittedAtMs") if first else None,
        "firstStableWordMs": first_stable_word_ms,
        "hypothesisCount": len(hypotheses),
        "revisionCount": revisions,
        "churnChars": churn,
        "revisionRatio": churn / max(len(final_text), 1),
        "stopToFinalMs": (final_event or {}).get("finishLatencyMs"),
        "finalText": final_text,
        "audioDurationMs": (final_event or {}).get("audioDurationMs"),
        "status": "success" if final_event is not None else "error",
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("events", type=Path)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    result = analyze(load_events(args.events))
    encoded = json.dumps(result, ensure_ascii=False, indent=2) + "\n"
    if args.output:
        args.output.write_text(encoded)
    else:
        print(encoded, end="")


if __name__ == "__main__":
    main()
