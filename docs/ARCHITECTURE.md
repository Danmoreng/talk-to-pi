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
  ├─ NeMo-Speech.cpp C API
  └─ Nemotron streaming session
```

The extension does not use Node FFI. The native child process owns the microphone and model, and no network listener is opened. The final transcript is trimmed, appended to any text already in Pi's prompt editor, and handed back with `ctx.ui.setEditorText()`. Talk-to-Pi never calls `pi.sendUserMessage()`.

Native dependencies are pinned Git submodules. The runtime uses the NeMo-Speech.cpp C API ABI reported in its `hello` message and nlohmann/json for protocol parsing/serialization. The official NVIDIA Q8_0 model is resolved from the pinned Hugging Face snapshot cache; it is downloaded only after explicit user confirmation.
