# Development

The project currently implements the local Talk-to-Pi runtime:

- TypeScript package and Pi extension entry point;
- protocol parser/encoder and incremental JSONL decoder;
- runtime process manager with command correlation and shutdown escalation;
- read-only recording overlay with regular prompt-editor handoff;
- native C++ runtime with NeMo-Speech.cpp, miniaudio, and a bounded audio ring buffer;
- native JSONL protocol test;
- generic manifest validation, verified downloads, locking, and safe runtime archive extraction.

The production model is NVIDIA's official Nemotron Q8_0 GGUF:

- repository: `nvidia/nemotron-3.5-asr-streaming-0.6b`;
- revision: `1c8deaecc64b91f034d73e08dd8b64625eb3395d`;
- size: `741548352` bytes;
- SHA-256: `a5c435f294eea8f88ce68dd27b8c3bfea7f777cb2fbba04fcd30eaa555f429ae`.

Talk-to-Pi stores this file in the pinned Hugging Face snapshot path. If it is
missing, the first `/talk` asks for permission before downloading it. The
native runtime is built from public NVIDIA NeMo-Speech.cpp revision
`2e12e2def8a98ed06666f7ee3ca94e7193e04be4`. The build applies the tracked
CMake-only embedding patch under `native/patches/` and consumes the official
NVIDIA GGUF directly; no model conversion is needed.

For local development:

```bash
npm run build
npm run native:build
npm run local:pi
```

`npm run local:pi` supplies the locally built runtime. The model is downloaded
on first use into the Hugging Face cache after confirmation.
