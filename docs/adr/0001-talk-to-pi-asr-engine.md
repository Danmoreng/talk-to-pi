# ADR-0001: Talk-to-Pi ASR engine selection

**Status:** Accepted for the current development default
**Date:** 2026-08-06

## Context

The evaluation compared NVIDIA NeMo-Speech.cpp with parakeet.cpp using the same
pinned Nemotron source revision
`1c8deaecc64b91f034d73e08dd8b64625eb3395d` and identical PCM input.

## Evidence

- NeMo-Speech.cpp `2e12e2def8a98ed06666f7ee3ca94e7193e04be4` builds on CPU and CUDA.
- The official NVIDIA Q8_0 model loads directly in NeMo-Speech.cpp.
- The locally generated parakeet Q8_0 model is engine-specific and loads only in
  parakeet.cpp.
- Cross-engine model loading fails cleanly in both directions.
- On the English smoke fixture, CPU RTF was approximately `0.128` for NeMo and
  `0.165` for parakeet.
- The official NVIDIA model is smaller: approximately 742 MB versus 984 MB.

These remain smoke observations, not a German accuracy claim. The local
RTX 5080 CUDA experiment measured approximately `0.049` RTF after warm-up, but
CUDA remains optional because of higher startup and memory costs.

## Decision

NeMo-Speech.cpp is now the single production engine and default. The production
runtime uses NeMo's C ABI, the official NVIDIA Q8_0 GGUF, and a pinned Hugging
Face snapshot cache path. The first `/talk` asks permission before downloading
the model.

The parakeet.cpp implementation and generated model remain isolated under
`spikes/engine-evaluation/` for historical comparison only. They are not part
of the production runtime.

The existing JSONL protocol and Pi editor handoff remain unchanged. NeMo
cumulative interim hypotheses are represented as replacement transcript updates
so revisions never get appended as duplicated text.

## Remaining release validation

- German coding corpus and references;
- primary-user A/B sessions;
- repeated-session and cancellation soaks;
- clean-system installation with a published verified runtime archive;
- final accuracy and confidence-interval report.
