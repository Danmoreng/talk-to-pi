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
    stream_started = next((e for e in events if e.get("event") == "stream_started"), None)
    stream_start_ms = float((stream_started or {}).get("emittedAtMs", 0.0))
    stable = [e for e in hypotheses if e.get("engineStable")]
    first_stable_word_ms = None
    if stable:
        first_stable_word_ms = stable[0].get("emittedAtMs", 0.0) - stream_start_ms
    final_text = str((final_event or {}).get("text", texts[-1] if texts else ""))
    audio_duration_ms = (final_event or {}).get("audioDurationMs")
    process_exited = next((e for e in reversed(events) if e.get("event") == "process_exited"), None)
    stream_elapsed_ms = None
    realtime_factor = None
    if process_exited and audio_duration_ms:
        stream_elapsed_ms = process_exited.get("emittedAtMs", 0.0) - stream_start_ms
        realtime_factor = stream_elapsed_ms / audio_duration_ms
    return {
        "ttfhMs": first.get("emittedAtMs") - stream_start_ms if first else None,
        "firstStableWordMs": first_stable_word_ms,
        "hypothesisCount": len(hypotheses),
        "revisionCount": revisions,
        "churnChars": churn,
        "revisionRatio": churn / max(len(final_text), 1),
        "stopToFinalMs": (final_event or {}).get("finishLatencyMs"),
        "streamElapsedMs": stream_elapsed_ms,
        "realtimeFactor": realtime_factor,
        "finalText": final_text,
        "audioDurationMs": audio_duration_ms,
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
