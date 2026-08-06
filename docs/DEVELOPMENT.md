# Development

The project currently implements the Milestone 0/1 foundation:

- TypeScript package and Pi extension entry point;
- protocol parser/encoder and incremental JSONL decoder;
- runtime process manager with command correlation and shutdown escalation;
- read-only recording overlay;
- regular prompt-editor handoff;
- native C++ runtime skeleton with parakeet.cpp and miniaudio integration;
- native JSONL protocol test;
- generic manifest validation, verified downloads, locking, and safe runtime archive extraction.

The model artifact is intentionally not guessed. They remain release gates in the development plan until a compatible, licensed GGUF is validated with fixtures.
