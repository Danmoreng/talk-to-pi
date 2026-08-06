# Architecture

Talk-to-Pi has two isolated processes:

```text
Pi TypeScript extension
  ├─ /talk and /talk-doctor
  ├─ focused recording overlay
  ├─ prompt-editor handoff
  └─ managed child-process lifecycle
          │ JSONL stdin/stdout
          ▼
talk-to-pi-runtime
  ├─ miniaudio capture
  ├─ bounded audio ring buffer
  ├─ inference worker
  ├─ parakeet.cpp C API
  └─ Nemotron streaming session
```

The extension does not use Node FFI. The native child process owns the microphone and model, and no network listener is opened. The final transcript is trimmed and handed to Pi's existing prompt editor with `ctx.ui.setEditorText()`. Talk-to-Pi never calls `pi.sendUserMessage()`.

Native dependencies are pinned Git submodules. The runtime uses the parakeet C API ABI reported in its `hello` message and nlohmann/json for protocol parsing/serialization.
