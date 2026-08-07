# Changelog

## 0.1.1 - 2026-08-07

- Fixed the Windows runtime crash while loading the GGUF model by using one shared dynamic MSVC runtime across the native DLL boundary.
- Added a Windows release smoke test that downloads the pinned model, verifies its checksum, loads it in the packaged runtime, waits for readiness, and shuts it down cleanly.

## 0.1.0 - 2026-08-07

- Initialized the TypeScript extension and native runtime skeleton.
- Added JSONL protocol validation, runtime process management, and the read-only recording overlay.
- Added handoff to Pi's regular prompt editor without automatic submission.
- Selected NeMo-Speech.cpp as the sole production engine and removed the evaluation backend.
- Added persistent `/talk-config` settings with `Alt+R` as the default shortcut.
- Added automatic native-runtime recovery after terminal recording failures.
- Made Git and npm Pi packages load the checked-in TypeScript source directly.
- Added verified CPU runtime releases for Linux x64/ARM64, macOS Intel/Apple Silicon, and Windows x64.
