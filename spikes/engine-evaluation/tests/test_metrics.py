from __future__ import annotations

import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def load(name: str, filename: str):
    spec = importlib.util.spec_from_file_location(name, ROOT / "scripts" / filename)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


analysis = load("analysis", "analyze-streaming.py")
scoring = load("scoring", "score-transcripts.py")


class MetricsTest(unittest.TestCase):
    def test_streaming_metrics_distinguish_revisions(self):
        events = [
            {"event": "hypothesis", "text": "hello", "emittedAtMs": 100, "engineStable": False},
            {"event": "hypothesis", "text": "hello world", "emittedAtMs": 200, "engineStable": True},
            {"event": "final_result", "text": "hello world", "finishLatencyMs": 40},
        ]
        result = analysis.analyze(events)
        self.assertEqual(result["ttfhMs"], 100)
        self.assertEqual(result["firstStableWordMs"], 200)
        self.assertEqual(result["revisionCount"], 1)
        self.assertEqual(result["stopToFinalMs"], 40)

    def test_scoring_is_zero_for_matching_transcript(self):
        result = scoring.score("Hello, world.", "hello world")
        self.assertEqual(result["wer"], 0)
        self.assertGreater(result["cer"], 0)

    def test_event_log_is_jsonl_readable(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "events.jsonl"
            path.write_text(json.dumps({"event": "final_result"}) + "\n")
            self.assertEqual(analysis.load_events(path)[0]["event"], "final_result")


if __name__ == "__main__":
    unittest.main()
