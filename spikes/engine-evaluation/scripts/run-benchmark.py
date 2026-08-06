#!/usr/bin/env python3
"""Run paired engine evaluations over a JSONL corpus."""
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import subprocess
import time
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent


def load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None: raise RuntimeError(f"cannot load {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


analysis = load_module("analysis", SCRIPT_DIR / "analyze-streaming.py")
scoring = load_module("scoring", SCRIPT_DIR / "score-transcripts.py")
analyze = analysis.analyze
load_events = analysis.load_events
score = scoring.score

ROOT = SCRIPT_DIR.parent
DEFAULT_EVAL = ROOT / "build" / "talk-to-pi-engine-eval"
MODELS = {
    "nemo": ROOT / "models/nemo-speech/nemotron-3.5-asr-streaming-0.6b.q8_0.gguf",
    "parakeet": ROOT / "models/parakeet/nemotron-3.5-asr-streaming-0.6b.parakeet.q8_0.gguf",
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--engine", choices=["nemo", "parakeet", "both"], default="both")
    parser.add_argument("--corpus", type=Path, default=ROOT / "corpus/manifest.jsonl")
    parser.add_argument("--output", type=Path, default=ROOT / "results")
    parser.add_argument("--eval-binary", type=Path, default=DEFAULT_EVAL)
    parser.add_argument("--language", default=None)
    parser.add_argument("--right-context", type=int, default=3)
    parser.add_argument("--push-ms", type=int, default=20)
    parser.add_argument("--pace", choices=["realtime", "unpaced"], default="realtime")
    parser.add_argument("--threads", type=int, default=4)
    parser.add_argument("--repeat", type=int, default=1)
    args = parser.parse_args()

    if not args.eval_binary.exists(): raise SystemExit(f"evaluation binary not found: {args.eval_binary}")
    entries = [json.loads(line) for line in args.corpus.read_text().splitlines() if line.strip()]
    engines = ["nemo", "parakeet"] if args.engine == "both" else [args.engine]
    args.output.mkdir(parents=True, exist_ok=True)
    summary = []
    for entry in entries:
        audio = (ROOT / "corpus" / entry["audio"]).resolve()
        reference = (ROOT / "corpus" / entry["reference"]).resolve() if entry.get("reference") else None
        language = args.language or entry.get("language", "de-DE")
        for repeat in range(1, args.repeat + 1):
            ordered_engines = engines if repeat % 2 else list(reversed(engines))
            for engine in ordered_engines:
                stem = f"{entry['id']}-{engine}-r{repeat}"
                event_path = args.output / f"{stem}.jsonl"
                stderr_path = args.output / f"{stem}.stderr.log"
                command = [str(args.eval_binary), "--engine", engine, "--model", str(MODELS[engine]),
                           "--audio", str(audio), "--language", language, "--right-context", str(args.right_context),
                           "--push-ms", str(args.push_ms), "--pace", args.pace, "--threads", str(args.threads),
                           "--run-id", stem]
                started = time.monotonic()
                with event_path.open("w") as output, stderr_path.open("w") as errors:
                    completed = subprocess.run(command, stdout=output, stderr=errors, text=True)
                events = load_events(event_path)
                metrics = analyze(events)
                if reference and metrics["finalText"] is not None:
                    metrics["accuracy"] = score(reference.read_text(), metrics["finalText"], entry.get("expectedTerms", []))
                result = {
                    "schemaVersion": 1,
                    "runId": stem,
                    "engine": {"name": engine, "revision": "locked"},
                    "model": {"path": str(MODELS[engine]), "sha256": sha256(MODELS[engine]), "sizeBytes": MODELS[engine].stat().st_size},
                    "configuration": {"language": language, "rightContextFrames": args.right_context, "pushMs": args.push_ms, "pace": args.pace, "threads": args.threads, "repeat": repeat},
                    "audio": {"id": entry["id"], "path": str(audio), "durationMs": entry.get("durationMs")},
                    "metrics": metrics,
                    "status": "success" if completed.returncode == 0 else "error",
                    "exitCode": completed.returncode,
                    "wallTimeMs": (time.monotonic() - started) * 1000,
                }
                (args.output / f"{stem}.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
                summary.append(result)
    (args.output / "summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n")


if __name__ == "__main__":
    main()
