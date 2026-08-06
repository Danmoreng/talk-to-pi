# ADR-0001: Talk-to-Pi ASR engine evaluation

**Status:** Draft — no final engine decision yet
**Date:** 2026-08-06

## Context

Talk-to-Pi currently uses parakeet.cpp. The evaluation spike compares it with
NVIDIA NeMo-Speech.cpp using the same pinned NVIDIA Nemotron source revision
`1c8deaecc64b91f034d73e08dd8b64625eb3395d` and the same PCM fixture.

## Implemented evidence

- NeMo-Speech.cpp `2e12e2def8a98ed06666f7ee3ca94e7193e04be4` builds on CPU.
- parakeet.cpp `5fd500fad54ef86254d675c494cbb3a5eb821df4` builds on CPU.
- NVIDIA's official Q8_0 model loads only in NeMo-Speech.cpp.
- The locally generated parakeet Q8_0 model loads only in parakeet.cpp.
- Cross-engine model loading fails cleanly in both directions.
- A common JSONL runner feeds identical 16 kHz mono PCM to both engines.
- Smoke WER is 0 for both engines on the existing LibriSpeech fixture.

The smoke result is not sufficient for a product decision. It is an English
public fixture, not the German coding corpus, and it does not include the
required blinded user sessions, soak tests, F16 controls, or confidence
intervals.

## Current smoke observations

| Metric | NeMo-Speech.cpp | parakeet.cpp |
|---|---:|---:|
| Q8 model size | 741,548,352 bytes | 983,696,480 bytes |
| Real-time TTFH | approximately 1,008 ms | approximately 1,029 ms |
| Real-time stop-to-final | approximately 69 ms | approximately 53 ms |
| Smoke WER | 0.000 | 0.000 |

These values are harness smoke observations, not release claims.

## Decision

Deferred until the decision corpus and primary-user A/B sessions are available.
Production remains single-engine parakeet.cpp; NeMo-Speech.cpp remains isolated
under `spikes/engine-evaluation/`.

## Next evidence required

1. Record the Stage A and Stage B German coding corpus.
2. Run the paired 320 ms CPU matrix with alternating order.
3. Run 100-session and cancel soaks.
4. Measure stable-prefix latency and manual edit ratio.
5. Complete blinded `/talk-eval` sessions.
6. Update this ADR to select exactly one engine.
