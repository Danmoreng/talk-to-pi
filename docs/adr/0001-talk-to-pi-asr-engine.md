# ADR-0001: Talk-to-Pi ASR engine selection

**Status:** Accepted
**Date:** 2026-08-06

## Context

Talk-to-Pi needs a local streaming ASR runtime that can be built for Linux CPU
and optionally CUDA, exposes a stable native API, and can consume a reproducibly
pinned multilingual model.

## Decision

Talk-to-Pi uses NVIDIA NeMo-Speech.cpp as its only production ASR engine. The
runtime is pinned to public NVIDIA revision
`2e12e2def8a98ed06666f7ee3ca94e7193e04be4` and applies a tracked CMake-only
embedding patch from `native/patches/`.

The production model is NVIDIA's official Nemotron 3.5 ASR Streaming 0.6B Q8_0
GGUF from pinned Hugging Face revision
`1c8deaecc64b91f034d73e08dd8b64625eb3395d`. No project-specific model
conversion is required.

NeMo cumulative interim hypotheses are represented as replacement transcript
updates so revisions are never appended as duplicate text. The JSONL process
boundary and Pi editor handoff remain engine-independent implementation
boundaries, but no second ASR backend is shipped or maintained.

## Rationale

- official preconverted NVIDIA model artifact;
- immutable Hugging Face revision with exact size and SHA-256;
- smaller supply-chain surface than maintaining a converter and another engine;
- CPU and optional CUDA support from one upstream implementation;
- public C ABI suitable for the isolated native child process.

## Remaining release validation

- German coding corpus and references;
- repeated-session, failure-recovery, and cancellation soaks;
- clean-system installation with a published verified runtime archive;
- final accuracy and latency report.
