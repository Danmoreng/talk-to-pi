#!/usr/bin/env python3
"""Score one final transcript without engine-specific cleanup."""
from __future__ import annotations

import argparse
import json
import re
import unicodedata
from pathlib import Path


def words(text: str) -> list[str]:
    text = unicodedata.normalize("NFKC", text).lower()
    return re.findall(r"\w+(?:['’]\w+)?", text, flags=re.UNICODE)


def chars(text: str) -> list[str]:
    return list(unicodedata.normalize("NFKC", text))


def distance(reference: list[str], hypothesis: list[str]) -> int:
    previous = list(range(len(hypothesis) + 1))
    for i, expected in enumerate(reference, 1):
        current = [i]
        for j, actual in enumerate(hypothesis, 1):
            current.append(min(current[-1] + 1, previous[j] + 1, previous[j - 1] + (expected != actual)))
        previous = current
    return previous[-1]


def score(reference: str, hypothesis: str, expected_terms: list[str] | None = None) -> dict:
    reference_words = words(reference)
    hypothesis_words = words(hypothesis)
    reference_chars = chars(reference)
    hypothesis_chars = chars(hypothesis)
    term_results = []
    for term in expected_terms or []:
        lower = term.casefold()
        term_results.append({
            "term": term,
            "exact": term in hypothesis,
            "caseInsensitive": lower in hypothesis.casefold(),
        })
    return {
        "wer": distance(reference_words, hypothesis_words) / max(len(reference_words), 1),
        "cer": distance(reference_chars, hypothesis_chars) / max(len(reference_chars), 1),
        "editCost": distance(reference_chars, hypothesis_chars) / max(len(reference_chars), 1),
        "technicalTerms": term_results,
        "technicalTermExactRecall": (
            sum(item["exact"] for item in term_results) / len(term_results)
            if term_results else None
        ),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--reference", type=Path, required=True)
    parser.add_argument("--hypothesis", required=True)
    parser.add_argument("--expected-term", action="append", default=[])
    args = parser.parse_args()
    print(json.dumps(score(args.reference.read_text(), args.hypothesis, args.expected_term), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
