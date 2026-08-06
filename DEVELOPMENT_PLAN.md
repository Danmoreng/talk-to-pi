# Talk-to-Pi — Development Plan

**Document status:** Implementation-ready proposal

**Document version:** 1.1

**Research snapshot:** 2026-08-06

**Target release:** `v0.1.0`

**Code license:** MIT

**Product type:** Pi Coding Agent extension with a managed native runtime

**Primary platform for the MVP:** Linux x86_64, CPU inference

**ASR engine:** `NeMo-Speech.cpp`

**ASR model:** NVIDIA Nemotron 3.5 ASR Streaming 0.6B, official pinned Q8_0 GGUF from the Hugging Face cache
**Scope:** Local streaming speech-to-text only; no LLM cleanup, no cloud backend, no server configuration

---

## 1. Executive Summary

Talk-to-Pi is a local voice-input extension for the Pi Coding Agent. It lets a user invoke `/talk`, speak into the default microphone, watch a live transcript appear inside a focused terminal overlay, stop recording, and receive the finalized text in Pi's regular prompt editor for editing and explicit submission.

The extension is deliberately narrow:

- one coding-agent integration: Pi;
- one inference engine: `NeMo-Speech.cpp`;
- one model family: NVIDIA Nemotron 3.5 ASR Streaming 0.6B;
- one managed native process;
- one local microphone;
- one editable transcript;
- no cleanup LLM;
- no external server;
- no backend abstraction;
- no automatic submission.

The native process links `NeMo-Speech.cpp` and captures the microphone directly. The Pi extension communicates with it over newline-delimited JSON on stdin/stdout. There are no ports, sockets, background services, Docker containers, or user-managed daemons.

The code in this repository is MIT-licensed. The model weights are not MIT-licensed and must retain their own governing license and attribution. The model should be downloaded from the pinned NVIDIA Hugging Face revision into the user's Hugging Face cache after explicit first-use confirmation rather than embedded in the npm package.

---

## 2. Product Name and Positioning

### 2.1 Locked working name

**Display name:** `Talk-to-Pi`

**Repository slug:** `talk-to-pi`

**Slash command:** `/talk`

**Native binary:** `talk-to-pi-runtime`

**Suggested npm package:** `@<owner>/talk-to-pi`
**Suggested tagline:** `Local, live Nemotron dictation for the Pi coding agent.`

`Talk-to-Pi` is preferable to `Talk2Pi`:

- it reads naturally;
- it says exactly what the product does;
- it avoids looking like a Raspberry Pi utility or a numbered sequel;
- it maps cleanly to the `/talk` command;
- it is easier to discover in prose and documentation.

`TTP` can be used internally in code or issue labels, but it should not be the primary public brand because it is less searchable and less self-explanatory.

Old repositories with similar names that target Raspberry Pi hardware are not a meaningful product conflict. Before publishing, still perform a final npm-name check and a basic trademark/name search. GitHub repository names only need to be unique within the chosen owner account.

### 2.2 Product differentiation

A recent Pi package, `rpiv-voice`, already provides local live dictation using sherpa-onnx and Whisper. Talk-to-Pi should not claim to be the first local voice extension for Pi.

Its clear differentiation is:

- Nemotron 3.5 rather than Whisper;
- model-native cache-aware streaming;
- `parakeet.cpp` rather than sherpa-onnx;
- a single managed native runtime;
- stable incremental transcript deltas;
- a deliberately smaller configuration and feature surface;
- Linux-first optimization for a coding-terminal workflow.

Do not copy implementation code from another project. MIT-licensed projects may be consulted for Pi TUI patterns, but copied material must retain any required attribution and should be avoided unless it provides substantial value.

---

## 3. Product Vision

The product should feel like a native Pi feature:

```text
pi
  ↓
/talk
  ↓
speak while the transcript appears
  ↓
Enter to stop and finalize
  ↓
transcript moves to Pi's regular prompt editor
  ↓
edit with the usual Pi controls
  ↓
Enter to send
```

The user should not have to:

- install Python;
- install NeMo;
- compile `parakeet.cpp`;
- start a server;
- create a systemd service;
- select a port;
- configure an API endpoint;
- manage process lifecycles;
- understand GGUF;
- save or upload an audio file.

After the first managed download, the speech-recognition path must work fully offline.

A privacy statement in the README must be precise:

> Microphone audio is processed locally and is not uploaded by Talk-to-Pi. Once the user submits the transcript, the text follows Pi's normal model-provider behavior.

---

## 4. MVP User Experience

### 4.1 Installation

Proposed installation:

```bash
pi install npm:@<owner>/talk-to-pi
```

Development installation:

```bash
pi install /absolute/path/to/talk-to-pi
```

The package must not rely on `postinstall` or any npm lifecycle script. Pi package installation behavior can vary by package source and configured package-manager wrapper, and lifecycle scripts are not a suitable provisioning API. Automatic native downloads during npm installation also create unnecessary supply-chain risk.

### 4.2 First use

1. The user starts Pi.
2. Talk-to-Pi loads but does not silently download a large model.
3. The user runs `/talk`.
4. A focused setup overlay appears.
5. The extension downloads:
   - the platform-specific `talk-to-pi-runtime` release asset;
   - the pinned Nemotron Q8_0 model artifact;
   - required license and attribution files if they are not already shipped in the npm package.
6. The extension verifies exact file sizes and SHA-256 hashes.
7. Files are atomically installed into the managed data directory.
8. The native runtime starts and loads the model.
9. Recording begins automatically.
10. Subsequent Pi launches start the already-installed runtime automatically in the background.

The first-use UI must show:

- which files are being downloaded;
- exact download size;
- progress;
- model source;
- model license;
- retryable errors;
- the final installed paths in `/talk-doctor`.

### 4.3 Normal use

The default command is:

```text
/talk
```

The overlay opens in recording mode:

```text
┌─ Talk-to-Pi ──────────────────────────────────────────────────┐
│                                                               │
│  Please inspect the authentication flow and find out why      │
│  the refresh token is not updated after the access token      │
│  expires.                                                     │
│                                                               │
│  ● Listening · de-DE · local                                  │
│                                                               │
│  Enter stop   Esc discard                                     │
└───────────────────────────────────────────────────────────────┘
```

During recording:

- transcript deltas appear incrementally;
- emitted text is append-only and stable;
- editing is disabled;
- `Enter` stops recording and requests finalization;
- `Esc` cancels and discards the session;
- an end-of-utterance event may update the status, but must not auto-send.

After finalization:

1. the authoritative transcript is trimmed at its beginning and end;
2. the overlay closes;
3. the transcript is appended to the prompt editor's existing text with one separating space when needed;
4. the combined text is handed to Pi's regular prompt editor with `ctx.ui.setEditorText(text)`;
5. focus returns to the normal Pi input box.

The user then edits and submits with the same editor, keybindings, multiline behavior, custom editor component, and terminal integration used for typed prompts. Talk-to-Pi does not call `pi.sendUserMessage()` and never submits the transcript itself. An empty or whitespace-only transcript closes with a short notification and is not inserted.

### 4.4 Busy-agent behavior

For `v0.1.0`, `/talk` should require Pi to be idle.

When Pi is already generating a response:

```text
Talk-to-Pi is available when the agent is idle.
```

Do not implement steering, follow-up delivery, or recording while Pi is busy in the MVP. Those modes introduce additional message-queue and expectation-management complexity.

### 4.5 Non-TUI modes

Talk-to-Pi is a terminal-interactive feature.

In `rpc`, `json`, or `print` mode, `/talk` must fail cleanly with a short message stating that interactive TUI mode is required. `ctx.ui.custom()` is not a portable interface in those modes.

---

## 5. Locked MVP Decisions

| Area | Decision |
|---|---|
| Product name | Talk-to-Pi |
| Primary command | `/talk` |
| Pi integration | TypeScript extension |
| TUI | Focused `ctx.ui.custom()` overlay during setup, recording, and finalization |
| Editable text | Pi's regular prompt editor via `ctx.ui.setEditorText(text)` |
| Message submission | Pi's normal prompt-editor submission flow |
| Runtime | One managed native child process |
| Runtime language | C++17 |
| Audio capture | `miniaudio`, vendored and pinned |
| Native JSON | `nlohmann/json`, vendored and pinned |
| ASR engine | `parakeet.cpp`, vendored and pinned |
| Model | Nemotron 3.5 ASR Streaming 0.6B |
| Quantization | Stock-compatible Q8_0 GGUF |
| Initial target | Linux x86_64, CPU |
| IPC | JSON Lines over child-process stdin/stdout |
| Network after setup | None |
| Audio persistence | None |
| Transcript cleanup | None |
| Alternate backends | None |
| External servers | None |
| Auto-submit | Never |
| Automatic endpoint stop | Not in MVP |
| Package code license | MIT |
| Model license | Preserved separately; never described as MIT |

These decisions are scope boundaries. A coding agent must not generalize the design into a provider framework during the MVP.

---

## 6. Explicit Non-Goals

The following are outside `v0.1.0`:

- LLM cleanup or rewriting;
- OpenAI, Ollama, llama.cpp, or other remote/local APIs;
- user-configurable ASR engines;
- multiple ASR models;
- TTS or spoken agent responses;
- automatic submission after silence;
- wake-word detection;
- speaker diarization;
- translation;
- Android-as-a-backend;
- network audio streaming;
- a reusable public STT server;
- systemd, launchd, Docker, or background services;
- microphone-device selection UI;
- macOS or Windows release support;
- CUDA, Vulkan, Metal, or ROCm release variants;
- sharing one runtime between several Pi processes;
- recording while Pi is busy;
- replacing or globally customizing Pi's normal prompt editor;
- speculative or retroactively rewritten partial hypotheses;
- telemetry;
- transcript history;
- audio-file transcription as a user-facing feature.

A fixture-file mode is allowed internally for tests, but it is not a user-facing product feature.

---

## 7. Technical Context and Upstream Capabilities

### 7.1 Pi extension capabilities used

Current Pi extension APIs provide the required primitives:

- `pi.registerCommand()` for `/talk`;
- `ctx.ui.custom()` for a focused recording overlay;
- `ctx.ui.setEditorText()` to hand the final transcript to Pi's regular prompt editor;
- `ctx.mode` and `ctx.hasUI` for mode checks;
- `ctx.isIdle()` to require an idle agent before recording;
- `session_start` and `session_shutdown` lifecycle events;
- `ctx.ui.setStatus()` and `ctx.ui.notify()` for runtime state and errors.

Implementation must pin and test against a specific minimum `@earendil-works/pi-coding-agent` version. At the research snapshot, the current package is `0.84.0` and requires Node `>=22.19.0`. Re-check this immediately before implementation and release.

### 7.2 parakeet.cpp behavior used

The native runtime should use the flat C API rather than scraping CLI output.

Required calls:

```c
parakeet_ctx* parakeet_capi_load(const char* gguf_path);

parakeet_stream* parakeet_capi_stream_begin_lang(
    parakeet_ctx* ctx,
    const char* target_lang
);

char* parakeet_capi_stream_feed(
    parakeet_stream* stream,
    const float* pcm,
    int n_samples,
    int* event_mask
);

char* parakeet_capi_stream_finalize(parakeet_stream* stream);

void parakeet_capi_stream_free(parakeet_stream* stream);
void parakeet_capi_free(parakeet_ctx* ctx);
void parakeet_capi_free_string(char* value);
```

The stream consumes 16 kHz mono floating-point PCM.

The key semantic constraint is important:

> `parakeet_capi_stream_feed()` returns newly finalized text since the previous call.

Therefore, Talk-to-Pi's live transcript should be modeled as stable append-only deltas. The MVP must not claim to show unstable rolling hypotheses unless an upstream API explicitly adds them later.

This is an advantage for the editor design: already-displayed words do not need to be replaced as later chunks arrive.

### 7.3 Model behavior used

Nemotron 3.5 ASR Streaming 0.6B provides:

- multilingual speech recognition;
- native punctuation and capitalization;
- cache-aware streaming;
- language prompting;
- automatic language detection;
- German `de-DE` support;
- a 600M-parameter FastConformer-RNNT architecture.

The MVP should use an explicit language whenever a supported system locale can be identified, because it avoids language-tag cleanup and should provide more predictable recognition than automatic detection.

For unsupported or unknown system locales, use `auto` and strip only a validated trailing language tag format. Do not perform general text cleanup.

---

## 8. High-Level Architecture

```text
┌───────────────────────────────────────────────────────────────┐
│ Pi Coding Agent                                              │
│                                                               │
│  Talk-to-Pi TypeScript extension                              │
│  ├─ /talk command                                             │
│  ├─ managed asset provisioning                                │
│  ├─ child-process lifecycle                                   │
│  ├─ JSONL protocol parser                                     │
│  ├─ session state reducer                                     │
│  └─ focused recording overlay and prompt-editor handoff       │
└──────────────────────────────┬────────────────────────────────┘
                               │ stdin/stdout JSON Lines
                               │ no ports, no sockets
                               ▼
┌───────────────────────────────────────────────────────────────┐
│ talk-to-pi-runtime                                            │
│                                                               │
│  ├─ miniaudio microphone capture                              │
│  ├─ lock-free/single-producer audio ring buffer               │
│  ├─ inference worker                                          │
│  ├─ parakeet.cpp C API                                        │
│  ├─ Nemotron streaming session                                │
│  └─ protocol/event writer                                     │
└──────────────────────────────┬────────────────────────────────┘
                               │ local file mapping/read
                               ▼
┌───────────────────────────────────────────────────────────────┐
│ Nemotron 3.5 ASR Streaming 0.6B Q8_0 GGUF                     │
│ managed local model file                                      │
└───────────────────────────────────────────────────────────────┘
```

### 8.1 Why a native sidecar

A separate native process is preferred over Node FFI because it:

- isolates native crashes from Pi;
- avoids Node ABI compatibility problems;
- keeps audio callbacks and inference outside the JavaScript event loop;
- makes resource cleanup explicit;
- provides deterministic release artifacts;
- allows static linking;
- can be tested independently;
- does not expose a network service;
- keeps the TypeScript extension small.

### 8.2 Why one process rather than a server

The runtime is not a service. It is owned by one Pi extension instance.

- The extension spawns it.
- The extension knows its PID.
- The extension sends commands through stdin.
- The runtime emits events through stdout.
- The extension terminates it during Pi shutdown or reload.
- No other process is expected to connect.
- No port is allocated.
- No authentication is needed.
- No system-level service remains after Pi exits.

---

## 9. Repository Layout

Use one GitHub repository and one npm package.

```text
talk-to-pi/
├── .github/
│   ├── ISSUE_TEMPLATE/
│   ├── workflows/
│   │   ├── ci.yml
│   │   ├── native-release.yml
│   │   └── npm-release.yml
│   ├── dependabot.yml
│   └── pull_request_template.md
├── docs/
│   ├── ARCHITECTURE.md
│   ├── PROTOCOL.md
│   ├── DEVELOPMENT.md
│   ├── LICENSING.md
│   └── TROUBLESHOOTING.md
├── licenses/
│   ├── parakeet.cpp-MIT.txt
│   ├── miniaudio-MIT-0.txt
│   ├── nlohmann-json-MIT.txt
│   └── OpenMDW-1.1.txt
├── manifests/
│   ├── runtime-v1.json
│   └── model-v1.json
├── native/
│   ├── CMakeLists.txt
│   ├── cmake/
│   ├── include/
│   │   ├── audio_capture.hpp
│   │   ├── jsonl_protocol.hpp
│   │   ├── runtime_controller.hpp
│   │   └── transcription_engine.hpp
│   ├── src/
│   │   ├── audio_capture.cpp
│   │   ├── jsonl_protocol.cpp
│   │   ├── main.cpp
│   │   ├── runtime_controller.cpp
│   │   └── transcription_engine.cpp
│   ├── tests/
│   └── vendor/
│       ├── parakeet.cpp/
│       ├── miniaudio/
│       └── nlohmann-json/
├── scripts/
│   ├── build-native.mjs
│   ├── create-release-manifest.mjs
│   ├── verify-release-assets.mjs
│   └── smoke-install.mjs
├── src/
│   ├── index.ts
│   ├── command/
│   │   ├── doctor-command.ts
│   │   └── talk-command.ts
│   ├── config/
│   │   ├── language.ts
│   │   └── paths.ts
│   ├── provisioning/
│   │   ├── download.ts
│   │   ├── manifest.ts
│   │   └── provisioner.ts
│   ├── runtime/
│   │   ├── protocol.ts
│   │   ├── runtime-manager.ts
│   │   └── runtime-process.ts
│   ├── session/
│   │   ├── reducer.ts
│   │   ├── state.ts
│   │   └── talk-session.ts
│   └── ui/
│       ├── talk-overlay.ts
│       ├── transcript-view.ts
│       └── status-view.ts
├── test/
│   ├── fixtures/
│   ├── integration/
│   └── unit/
├── .editorconfig
├── .gitignore
├── CHANGELOG.md
├── CONTRIBUTING.md
├── DEVELOPMENT_PLAN.md
├── LICENSE
├── package.json
├── README.md
├── SECURITY.md
├── THIRD_PARTY_NOTICES.md
├── tsconfig.json
└── vitest.config.ts
```

### 9.1 Upstream source pinning

`native/vendor/parakeet.cpp`, `native/vendor/miniaudio`, and `native/vendor/nlohmann-json` must be pinned to exact commits or release tags. The runtime uses `nlohmann/json` rather than a hand-written JSON parser.

Recommended approach:

- use Git submodules for the three native dependencies;
- record exact commit SHAs in `docs/LICENSING.md`;
- update them only in dedicated dependency PRs;
- include upstream license files in release archives;
- never build production artifacts from a moving `master` reference.

If submodules prove too awkward for downstream contributors, replace them with a scripted, checksum-verified source fetch. Do not use unpinned CMake `FetchContent` references. Include the nlohmann/json MIT license and pinned version in the same third-party notice process as the other native dependencies.

---

## 10. npm Package Design

Suggested initial `package.json` shape:

```json
{
  "name": "@<owner>/talk-to-pi",
  "version": "0.1.0",
  "description": "Local, live Nemotron dictation for the Pi coding agent",
  "type": "module",
  "license": "MIT",
  "engines": {
    "node": ">=22.19.0"
  },
  "peerDependencies": {
    "@earendil-works/pi-coding-agent": "*",
    "@earendil-works/pi-tui": "*"
  },
  "pi": {
    "extensions": [
      "./dist/index.js"
    ]
  },
  "files": [
    "dist",
    "manifests",
    "licenses",
    "README.md",
    "LICENSE",
    "THIRD_PARTY_NOTICES.md"
  ],
  "keywords": [
    "pi-package",
    "pi-coding-agent",
    "speech-to-text",
    "asr",
    "voice-input",
    "nemotron",
    "parakeet",
    "local-ai"
  ]
}
```

Pi's bundled core packages must be declared as host-provided peer dependencies with `"*"` ranges and must not be bundled. Enforce the tested minimum Pi version through documentation, startup compatibility checks where useful, and CI rather than npm peer resolution. Remove the direct `@earendil-works/pi-tui` peer if the final extension imports no symbols from it.

The npm package should contain:

- compiled TypeScript/JavaScript;
- manifests;
- license notices;
- no model;
- no platform runtime archive;
- no install script.

The native runtime is distributed as a GitHub Release asset and installed on demand.

---

## 11. Managed Filesystem Layout

Honor XDG directories on Linux.

```text
$XDG_CONFIG_HOME/talk-to-pi/
└── config.json

$XDG_DATA_HOME/talk-to-pi/
├── models/
│   └── nemotron-3.5-asr-streaming-0.6b-q8_0-parakeet.gguf
├── licenses/
└── state.json

$XDG_CACHE_HOME/talk-to-pi/
├── runtime/
│   └── <runtime-version>/
│       └── talk-to-pi-runtime
├── downloads/
├── locks/
└── logs/
```

Fallbacks:

```text
~/.config/talk-to-pi
~/.local/share/talk-to-pi
~/.cache/talk-to-pi
```

Rules:

- models belong in the data directory;
- replaceable runtime binaries belong in the cache directory;
- partial downloads belong in the cache directory;
- config must be human-readable;
- no audio belongs anywhere on disk;
- logs must not contain transcripts by default.

---

## 12. Minimal Configuration

No configuration is required for normal use.

Optional file:

```json
{
  "language": "system"
}
```

Supported values:

- `"system"` — map the process locale to a supported Nemotron locale;
- `"auto"` — model automatic detection;
- an explicit locale such as `"de-DE"` or `"en-US"`.

For `v0.1.0`, do not expose:

- model paths;
- server URLs;
- engine selection;
- quantization choice;
- backend selection;
- arbitrary runtime arguments;
- microphone selection;
- chunk-size selection.

Developer-only environment variables are acceptable:

```text
TALK_TO_PI_DATA_DIR
TALK_TO_PI_RUNTIME_PATH
TALK_TO_PI_MODEL_PATH
TALK_TO_PI_LOG_LEVEL
TALK_TO_PI_TEST_AUDIO_FILE
```

These must be documented as unsupported development/debugging overrides, not normal user configuration.

### 12.1 Language resolution

Resolution order:

1. explicit config locale;
2. supported locale derived from `LC_ALL`, `LC_MESSAGES`, or `LANG`;
3. `auto`.

Normalize common forms:

```text
de_DE.UTF-8 → de-DE
en_US.UTF-8 → en-US
pt_BR.UTF-8 → pt-BR
```

Maintain an allowlist derived from the model's documented locale set.

When `auto` is used:

- recognize only the model's exact, documented language-tag syntax;
- strip the tag from the user-visible transcript;
- retain the detected language internally for status display;
- never run general regex-based text rewriting.

---

## 13. Native Runtime Design

### 13.1 Responsibilities

`talk-to-pi-runtime` owns:

- model loading;
- microphone device initialization;
- audio format conversion;
- audio buffering;
- streaming inference;
- EOU/EOB event forwarding;
- stable transcript-delta emission;
- finalization;
- error reporting;
- clean shutdown.

It does not own:

- downloads;
- UI;
- user configuration files;
- sending messages to Pi;
- transcript editing;
- network access.

### 13.2 Runtime command line

Proposed command:

```bash
talk-to-pi-runtime \
  --stdio \
  --model /path/to/model.gguf \
  --protocol-version 1 \
  --threads 0
```

Useful diagnostic modes:

```bash
talk-to-pi-runtime --version
talk-to-pi-runtime --list-audio-devices
talk-to-pi-runtime --self-test --model /path/to/model.gguf --audio fixture.wav
```

`--self-test` is intended for `/talk-doctor` and CI. It must not become a general user-facing file-transcription feature.

### 13.3 Runtime states

```text
booting
  → loading_model
  → ready
  → recording
  → finalizing
  → ready
  → shutting_down
  → exited
```

Invalid transitions must return protocol errors rather than silently doing the wrong thing.

Examples:

- `start` while already recording: reject;
- `stop` while ready: reject;
- `cancel` while ready: reject with a correlated protocol error;
- `shutdown` from any state: stop capture, free stream, free model, exit.

### 13.4 Audio capture

Use pinned `miniaudio` source directly in the native runtime.

Target format delivered to parakeet.cpp:

```text
sample rate: 16,000 Hz
channels: 1
sample type: float32
range: [-1.0, 1.0]
```

The native capture layer should request the target format. When the device/backend cannot provide it directly, use miniaudio's conversion/resampling support.

Threading rules:

- the audio callback must never perform inference;
- the audio callback must never allocate in the steady state;
- the audio callback writes frames into a bounded ring buffer;
- an inference worker drains the buffer;
- stdout writes happen outside the audio callback;
- capture overflow produces a visible recoverable error;
- debug assertions track dropped frames.

Use approximately 100 ms capture blocks when feeding the runtime worker, matching the proven parakeet.cpp test pattern. Do not hard-code the model's internal encoder chunk size in the extension.

### 13.5 Inference integration

On runtime startup:

1. validate that the model file exists and is readable;
2. load it once with `parakeet_capi_load`;
3. emit `ready`;
4. retain the context until shutdown.

On recording start:

1. create a fresh streaming session with `parakeet_capi_stream_begin_lang`;
2. clear ring-buffer counters and transcript accumulation;
3. open/start the default capture device;
4. emit `recording_started`.

For each drained audio block:

1. call `parakeet_capi_stream_feed`;
2. append non-empty returned text to the runtime's cumulative transcript;
3. emit one `transcript_delta` event;
4. inspect and forward EOU/EOB flags;
5. free the returned string.

On stop:

1. stop accepting microphone frames;
2. drain already-captured frames;
3. call `parakeet_capi_stream_finalize`;
4. append and emit any tail text;
5. emit `recording_finalized` with the complete transcript;
6. free the streaming session;
7. return to `ready`.

On cancel:

1. stop capture immediately;
2. discard queued frames;
3. free the streaming session without exposing a final transcript;
4. emit `recording_cancelled`;
5. return to `ready`.

### 13.6 No transcript logging

Normal stderr logs may include:

- runtime version;
- model hash;
- model-load duration;
- device/backend name;
- sample format;
- state transitions;
- error codes;
- inference timing;
- ring-buffer metrics.

They must not include:

- raw audio;
- transcript content;
- edited text;
- Pi messages.

A separate explicit developer flag may enable transcript logging, with a warning.

---

## 14. JSONL Protocol

Create `docs/PROTOCOL.md` and treat it as a versioned contract.

### 14.1 Transport rules

- one UTF-8 JSON object per line;
- extension commands on runtime stdin;
- runtime events on stdout;
- logs only on stderr;
- maximum line size: 1 MiB;
- protocol version field required;
- unknown event fields ignored for forward compatibility;
- unknown command types rejected;
- malformed JSON produces a protocol error;
- stdout must never contain non-JSON text.

### 14.2 Shared envelope

```ts
interface ProtocolMessage {
  v: 1;
  type: string;
  id?: string;
  sessionId?: string;
  seq?: number;
}
```

Every extension command contains a unique `id`. The runtime echoes that `id` in exactly one direct response: `pong`, `command_ack`, or a command-rejection `error`. Asynchronous lifecycle events do not carry a command `id`.

`sessionId` isolates recording sessions.

`seq` is monotonically increasing per runtime process and is present on every runtime-to-extension message.

### 14.3 Extension-to-runtime messages

#### Ping

```json
{"v":1,"type":"ping","id":"req-1"}
```

#### Start recording

```json
{
  "v": 1,
  "type": "start",
  "id": "req-2",
  "sessionId": "01J...",
  "language": "de-DE"
}
```

#### Stop and finalize

```json
{
  "v": 1,
  "type": "stop",
  "id": "req-3",
  "sessionId": "01J..."
}
```

#### Cancel

```json
{
  "v": 1,
  "type": "cancel",
  "id": "req-4",
  "sessionId": "01J..."
}
```

#### Shutdown

```json
{"v":1,"type":"shutdown","id":"req-5"}
```

### 14.4 Runtime-to-extension events

The sequence values below illustrate one possible successful flow. Terminal-event examples such as finalized, cancelled, and error are alternatives rather than events from the same recording.

#### Runtime hello

```json
{
  "v": 1,
  "type": "hello",
  "seq": 1,
  "runtimeVersion": "0.1.0",
  "protocolVersions": [1],
  "parakeetAbi": 6,
  "platform": "linux-x64-cpu"
}
```

#### Model loading

```json
{
  "v": 1,
  "type": "loading_model",
  "seq": 2
}
```

#### Ready

```json
{
  "v": 1,
  "type": "ready",
  "seq": 3,
  "model": "nemotron-3.5-asr-streaming-0.6b-q8_0",
  "modelLoadMs": 4321
}
```

#### Pong

```json
{"v":1,"type":"pong","id":"req-1","seq":4}
```

#### Command acknowledgement

```json
{
  "v": 1,
  "type": "command_ack",
  "id": "req-2",
  "seq": 5,
  "command": "start",
  "sessionId": "01J..."
}
```

An acknowledgement means that the command was accepted. State-specific completion is reported separately, for example with `recording_started`, `recording_finalized`, `recording_cancelled`, or `shutdown_complete`. A rejected command produces an `error` carrying the originating `id` instead of an acknowledgement.

#### Recording started

```json
{
  "v": 1,
  "type": "recording_started",
  "seq": 6,
  "sessionId": "01J...",
  "language": "de-DE",
  "audioDevice": "Default"
}
```

#### Stable transcript delta

```json
{
  "v": 1,
  "type": "transcript_delta",
  "seq": 7,
  "sessionId": "01J...",
  "text": "Please inspect the authentication flow"
}
```

The contract is append-only. `text` is newly finalized text, not the entire transcript and not a replacement.

#### End-of-utterance event

```json
{
  "v": 1,
  "type": "speech_event",
  "seq": 8,
  "sessionId": "01J...",
  "event": "eou",
  "timeSec": 4.72
}
```

Supported event values:

```text
eou
eob
```

The MVP displays these only as status information.

#### Optional audio level

```json
{
  "v": 1,
  "type": "audio_level",
  "seq": 9,
  "sessionId": "01J...",
  "rms": 0.13,
  "peak": 0.44
}
```

Rate-limit this event to at most 10 Hz. It may be omitted entirely from the first implementation.

#### Finalized recording

```json
{
  "v": 1,
  "type": "recording_finalized",
  "seq": 11,
  "sessionId": "01J...",
  "text": "Please inspect the authentication flow and find out why the refresh token is not updated.",
  "audioDurationMs": 6820,
  "finalizeMs": 84
}
```

The complete text is included for reconciliation. The extension must compare it with the concatenated deltas and use this complete value as authoritative.

#### Cancelled recording

```json
{
  "v": 1,
  "type": "recording_cancelled",
  "seq": 11,
  "sessionId": "01J..."
}
```

#### Error

```json
{
  "v": 1,
  "type": "error",
  "seq": 11,
  "sessionId": "01J...",
  "code": "MICROPHONE_UNAVAILABLE",
  "message": "No default capture device could be opened.",
  "recoverable": true
}
```

A command rejection includes the originating `id`; an asynchronous runtime or recording error omits it.

#### Shutdown complete

```json
{
  "v": 1,
  "type": "shutdown_complete",
  "seq": 13
}
```

### 14.5 Protocol invariants

- Every command receives exactly one correlated direct response within a bounded timeout.
- A session never emits deltas before `recording_started`.
- A session emits exactly one terminal event:
  - `recording_finalized`;
  - `recording_cancelled`; or
  - fatal `error`.
- Events from an old `sessionId` are ignored by the active UI.
- Sequence regressions are logged as protocol violations.
- A runtime crash never causes the extension to submit text automatically.
- The extension retains already-received text and hands it to Pi's prompt editor after a recoverable crash.

---

## 15. TypeScript Runtime Manager

### 15.1 Responsibilities

`RuntimeManager` should:

- resolve managed paths;
- read manifests;
- ensure assets exist and match hashes;
- spawn the runtime;
- parse JSONL;
- expose typed events;
- serialize commands;
- maintain readiness state;
- stop the child process;
- provide diagnostics;
- restart once after an unexpected pre-recording crash;
- never restart automatically during an active recording.

Suggested interface:

```ts
interface RuntimeManager {
  readonly state: RuntimeState;

  ensureProvisioned(
    onProgress: (progress: ProvisionProgress) => void,
    signal: AbortSignal
  ): Promise<void>;

  start(signal?: AbortSignal): Promise<void>;
  ensureReady(signal?: AbortSignal): Promise<void>;

  beginRecording(options: {
    sessionId: string;
    language: string;
    signal: AbortSignal;
  }): AsyncIterable<RuntimeEvent>;

  stopRecording(sessionId: string): Promise<void>;
  cancelRecording(sessionId: string): Promise<void>;

  getDiagnostics(): Promise<RuntimeDiagnostics>;
  shutdown(): Promise<void>;
}
```

### 15.2 Process spawning

Use `node:child_process.spawn()` with an argument array.

Never construct a shell command string.

```ts
spawn(runtimePath, args, {
  stdio: ["pipe", "pipe", "pipe"],
  shell: false,
  windowsHide: true
});
```

On Linux, use a process group only if it improves reliable cleanup. Ensure that only extension-owned processes can be killed.

Shutdown sequence:

1. send protocol `shutdown`;
2. wait for `shutdown_complete` or exit;
3. after a short timeout, send `SIGTERM`;
4. after another timeout, send `SIGKILL`;
5. close parsers and listeners;
6. clear state.

### 15.3 Lifecycle hooks

At extension initialization, register lifecycle handlers.

On `session_start`:

- if assets are present, start the runtime asynchronously;
- set a status such as `Talk-to-Pi: loading`;
- clear the status when ready;
- if assets are absent, do not download automatically;
- mark that setup will occur on first `/talk`.

On `session_shutdown`:

- abort any active talk session;
- close the overlay;
- shut down the runtime;
- clear status;
- make cleanup idempotent.

This must work for:

- normal exit;
- `/reload`;
- `/new`;
- `/resume`;
- `/fork`;
- process signals.

Do not start a runtime at module top level. Start it from lifecycle-aware code.

### 15.4 Multiple Pi instances

Each Pi process owns its own runtime in the MVP.

Use a file lock only for:

- model download;
- runtime archive download;
- extraction/installation.

Do not attempt to share a loaded model process between Pi instances. Document the memory implication.

---

## 16. Asset Provisioning

### 16.1 Runtime manifest

Example:

```json
{
  "schemaVersion": 1,
  "runtimeVersion": "0.1.0",
  "protocolVersion": 1,
  "artifacts": {
    "linux-x64-cpu": {
      "url": "https://github.com/<owner>/talk-to-pi/releases/download/runtime-v0.1.0/talk-to-pi-runtime-linux-x64-cpu.tar.gz",
      "sha256": "<hex>",
      "sizeBytes": 12345678,
      "archiveType": "tar.gz",
      "executable": "talk-to-pi-runtime"
    }
  }
}
```

The published package must reference an immutable release tag and exact hashes.

### 16.2 Model manifest

Example:

```json
{
  "schemaVersion": 1,
  "modelId": "nemotron-3.5-asr-streaming-0.6b-q8_0",
  "engine": "parakeet.cpp",
  "engineCompatibility": {
    "minimumAbi": 6,
    "maximumTestedAbi": 6
  },
  "source": {
    "repository": "<pinned Hugging Face repository>",
    "revision": "<commit SHA>",
    "filename": "nemotron-3.5-asr-streaming-0.6b-q8_0-parakeet.gguf"
  },
  "url": "<immutable resolved URL>",
  "sha256": "<hex>",
  "sizeBytes": 0,
  "license": "OpenMDW-1.1",
  "attribution": "NVIDIA Nemotron 3.5 ASR"
}
```

`sizeBytes` must contain the verified real value before release.

### 16.3 Model-artifact release gate

Do not finalize the model URL merely from a search result.

Before `v0.1.0`:

1. choose a GGUF generated for stock `parakeet.cpp`;
2. confirm the exact upstream source checkpoint;
3. confirm the converter and parakeet.cpp commit;
4. validate the Q8_0 file with German and English fixtures;
5. verify its license and attribution metadata;
6. pin the hosting repository revision;
7. compute SHA-256 independently;
8. archive the license text and model card snapshot;
9. document whether the project mirrors the file or downloads it from the model host.

Prefer the canonical artifact recommended by the `parakeet.cpp` project. If no sufficiently stable canonical artifact exists, create the GGUF in a reproducible release workflow from the official NVIDIA checkpoint and publish it separately with all required notices.

### 16.4 Download algorithm

For each asset:

1. acquire a cross-process lock with bounded waiting and safe stale-owner recovery;
2. check the final file and hash;
3. if valid, return immediately;
4. download to `<name>.partial`;
5. report byte progress;
6. enforce an expected maximum size;
7. verify exact size and SHA-256;
8. extract into a temporary directory if needed, without invoking a shell;
9. validate every archive entry against an exact allowlist;
10. reject absolute paths, `..` traversal, symlinks, hard links, device entries, excess file counts, and excess extracted size;
11. set executable permissions only on the expected runtime file;
12. atomically rename into the final versioned directory;
13. write an install-complete sentinel;
14. release the lock.

On failure:

- remove invalid partial files unless resumption is explicitly supported;
- preserve the previous valid version;
- show a retryable error;
- never execute an unverified binary.

### 16.5 No install scripts

Provisioning must happen from `/talk`, not npm installation.

Reasons:

- package installation behavior varies by source and configured package-manager wrapper;
- large hidden downloads are hostile UX;
- lifecycle scripts are a supply-chain risk;
- the extension can show proper progress and errors in its own UI;
- the managed cache can be repaired with `/talk-doctor`.

---

## 17. TUI and Editing Architecture

### 17.1 Pi API choice

Use:

```ts
ctx.ui.custom<T>(factory, {
  overlay: true,
  overlayOptions: {
    width: "80%",
    minWidth: 48,
    maxHeight: "80%",
    anchor: "center"
  }
});
```

The custom component is read-only and exists only for setup, recording, and finalization. When it returns a transcript, close it and call `ctx.ui.setEditorText(text)` so editing happens in Pi's existing prompt editor.

Do not embed a second editor and do not replace Pi's global editor via `setEditorComponent()`. Reusing the regular prompt editor preserves the user's configured editor component, keybindings, multiline behavior, history behavior, clipboard integration, and IME support.

### 17.2 UI state machine

```ts
type TalkUiState =
  | { kind: "provisioning"; progress: ProvisionProgress }
  | { kind: "starting_runtime" }
  | { kind: "recording"; text: string; startedAt: number; speechEvent?: "eou" | "eob" }
  | { kind: "finalizing"; text: string }
  | { kind: "error"; message: string; recoverable: boolean; text: string };
```

Transitions:

```text
provisioning
  → starting_runtime
  → recording
  → finalizing
  → transcript_handoff
  → closed
```

Cancellation:

```text
any interactive state
  → cancel runtime/session
  → closed without changing the prompt editor
```

Recoverable runtime failure during recording:

```text
recording
  → error with accumulated text
  → partial_transcript_handoff
  → closed
```

### 17.3 Component composition

Suggested overlay composition:

```text
DynamicBorder
TitleRow
ReadOnlyTranscript
StatusRow
ShortcutHelpRow
DynamicBorder
```

During recording and finalization:

- render transcript in a read-only wrapped view;
- append stable deltas;
- show a recording or finalizing indicator;
- use theme colors rather than hard-coded ANSI colors;
- request a render only when state changes or on a low-rate status tick.

Editing is deliberately outside this component. Once the overlay closes, Pi's regular editor owns focus, cursor movement, deletion, undo, paste, multiline input, Unicode, and IME behavior.

### 17.4 Keyboard behavior

Before recording, `Ctrl+R` invokes the same flow as `/talk` through Pi's extension
shortcut registry. This intentionally takes precedence over Pi's default session
rename binding while Talk-to-Pi is loaded.

Recording:

| Key | Action |
|---|---|
| `Enter` | Stop microphone and finalize |
| `Esc` | Cancel and discard |
| `Ctrl+C` | Cancel according to Pi/TUI conventions; do not leave the runtime recording |
| Other printable input | Ignore |

Finalizing:

| Key | Action |
|---|---|
| `Esc` | Cancel if safe; otherwise wait briefly for finalization and then discard |
| Other input | Ignore |

After handoff, Talk-to-Pi does not intercept keys. Pi's configured prompt editor handles submit, multiline input, editing, and cancellation exactly as it does for typed prompts. Overlay key detection must use `matchesKey()` and the injected keybinding manager rather than comparing raw terminal sequences.

### 17.5 Transcript handoff

After successful finalization:

1. choose the authoritative `recording_finalized.text`;
2. apply `text.trim()` to remove leading and trailing whitespace only;
3. if the result is empty, close the overlay and notify the user;
4. otherwise close the overlay with the transcript as its result;
5. append the result to the editor text captured before recording, preserving existing text and adding one separating space when needed;
6. call `ctx.ui.setEditorText(combinedText)` after `ctx.ui.custom()` resolves;
7. return focus to Pi's regular prompt editor;
8. do not call `pi.sendUserMessage()` and do not retain transcript history;

If a recoverable error occurs after text has appeared, perform the same handoff with the accumulated text and show an “incomplete transcript” warning. If editor handoff itself throws, retain the text in memory for the duration of the command, show an error, and offer a copyable fallback rather than discarding it.

### 17.6 Resize and narrow-terminal behavior

Requirements:

- every rendered line fits the provided width;
- transcript wrapping is Unicode-aware;
- the overlay remains usable at 48 columns;
- below the minimum width, show a clear fallback or use a full-width custom component;
- resize must not reset the displayed transcript;
- closing the overlay must restore focus to Pi's regular editor.

---

## 18. Pi Commands

### 18.1 `/talk`

Primary product command.

Optional syntax:

```text
/talk
/talk --lang de-DE
/talk --lang auto
```

For `v0.1.0`, command-line language override applies to one session and does not rewrite config unless explicitly documented.

### 18.2 `/talk-doctor`

Diagnostic command. It should report:

- Talk-to-Pi package version;
- Pi version;
- Node version;
- platform and architecture;
- runtime installation path;
- runtime version;
- runtime SHA-256 status;
- protocol version;
- parakeet C API ABI version;
- model path;
- model size and SHA-256 status;
- selected language;
- detected system locale;
- default audio device;
- model-load self-test result;
- fixture-transcription self-test result;
- whether a runtime process is currently alive.

Do not include transcripts or user content.

Support a copyable plain-text result.

### 18.3 Deferred commands

Not in `v0.1.0`:

```text
/talk-settings
/talk-devices
/talk-reset
/talk-benchmark
```

A repair action may be embedded in `/talk-doctor` or exposed later.

---

## 19. Error Handling

### 19.1 User-facing error categories

Use stable error codes internally:

```text
UNSUPPORTED_PLATFORM
ASSET_MANIFEST_INVALID
DOWNLOAD_FAILED
HASH_MISMATCH
EXTRACTION_FAILED
RUNTIME_NOT_EXECUTABLE
RUNTIME_PROTOCOL_MISMATCH
RUNTIME_CRASHED
MODEL_NOT_FOUND
MODEL_LOAD_FAILED
LANGUAGE_UNSUPPORTED
MICROPHONE_UNAVAILABLE
AUDIO_CAPTURE_FAILED
AUDIO_BUFFER_OVERFLOW
TRANSCRIPTION_FAILED
FINALIZATION_TIMEOUT
PI_BUSY
EDITOR_HANDOFF_FAILED
```

Messages should include one actionable next step.

Examples:

```text
The microphone could not be opened. Check the default input device and run /talk-doctor.
```

```text
The downloaded model did not match its expected checksum. The invalid file was removed; run /talk again to retry.
```

### 19.2 Preserve user text

The central error-handling rule:

> Once text has appeared, an error must not destroy it unless the user explicitly discards it.

If the runtime crashes after emitting text:

- stop showing the recording indicator;
- label the text as incomplete;
- close the overlay with the accumulated partial transcript;
- place the trimmed text into Pi's regular prompt editor;
- allow the user to edit and submit it normally;
- offer a retry only after the current handoff is resolved.

### 19.3 Finalization timeout

Use a bounded timeout, initially 5 seconds.

If finalization times out:

- stop/terminate the broken runtime;
- keep accumulated deltas;
- close the overlay and hand the text to Pi's prompt editor with an “incomplete finalization” warning;
- restart the runtime only after the overlay closes.

### 19.4 Runtime restart policy

Automatic restart is permitted only when:

- the runtime crashes before a recording starts;
- no overlay owns an active transcript;
- restart has not already been attempted in the current Pi session.

Never auto-restart mid-recording and silently continue. Audio continuity cannot be guaranteed.

---

## 20. Security and Privacy

### 20.1 Threat model

The extension downloads and executes native code and model data. Treat this as a supply-chain-sensitive path.

Controls:

- immutable release URLs;
- exact SHA-256 hashes;
- expected file sizes;
- atomic installation;
- allowlisted archive extraction with traversal/link/size defenses;
- no shell execution;
- no unverified binary execution;
- pinned native dependencies;
- GitHub Actions provenance where practical;
- release checksums;
- third-party notices;
- no transcript telemetry;
- no audio files;
- no listening socket.

### 20.2 Microphone behavior

- The microphone opens only during an active `/talk` recording.
- The runtime emits `recording_started` only after capture is active.
- The microphone closes on stop, cancel, error, reload, and shutdown.
- The UI must visibly indicate recording.
- There is no wake word or background listening.
- Audio is not retained.

### 20.3 Network behavior

Expected network use:

- first-use runtime download;
- first-use model download;
- explicit repair/update downloads.

After provisioning, speech recognition must work with networking disabled.

The submitted transcript may later be sent by Pi to the user's chosen model provider. The README must distinguish local audio processing from Pi's normal text-provider behavior.

### 20.4 Logs

Default logs:

- are local;
- rotate or remain bounded;
- exclude transcript text;
- exclude raw protocol bodies that contain deltas;
- exclude audio;
- can be deleted safely.

---

## 21. Licensing Plan

### 21.1 Project code

Files authored for Talk-to-Pi use the MIT License.

Include:

```text
LICENSE
```

with the project copyright holder.

### 21.2 parakeet.cpp

`parakeet.cpp` is MIT-licensed.

Include:

```text
licenses/parakeet.cpp-MIT.txt
```

and identify the pinned source commit in `THIRD_PARTY_NOTICES.md`.

### 21.3 miniaudio

Use miniaudio under its MIT No Attribution option rather than public-domain dedication, for clearer repository compliance.

Include:

```text
licenses/miniaudio-MIT-0.txt
```

and identify the pinned source version.

### 21.4 nlohmann/json

`nlohmann/json` is MIT-licensed.

Include:

```text
licenses/nlohmann-json-MIT.txt
```

and identify the pinned source version in `THIRD_PARTY_NOTICES.md`.

### 21.5 Model weights

The NVIDIA Nemotron model is governed separately, currently identified by the official model card as OpenMDW-1.1.

Requirements:

- do not describe the model as MIT;
- ship the applicable model license text or a legally sufficient notice;
- preserve origin and attribution notices;
- document the exact derivative GGUF source;
- perform a release-specific license review for the chosen GGUF host;
- state that the project is not affiliated with or endorsed by NVIDIA;
- avoid using NVIDIA logos without permission.

The README should use language such as:

> Talk-to-Pi code is MIT-licensed. The downloaded Nemotron model is governed by its own NVIDIA model license; see `docs/LICENSING.md`.

This plan is an engineering compliance checklist, not legal advice.

---

## 22. Testing Strategy

### 22.1 TypeScript unit tests

Test:

- protocol JSON parsing;
- unknown fields;
- malformed lines;
- line-size limits;
- acknowledgement correlation and command timeouts;
- rejected-command errors;
- sequence validation;
- session-ID filtering;
- runtime state transitions;
- UI reducer transitions;
- transcript-delta concatenation;
- final-text reconciliation;
- language normalization;
- XDG path resolution;
- manifest schema validation;
- checksum verification;
- partial-download cleanup;
- archive-entry allowlisting;
- traversal, symlink, hard-link, and extraction-limit rejection;
- atomic install behavior;
- process-exit handling;
- finalization timeout;
- shutdown idempotency;
- empty-transcript handoff rejection.

### 22.2 Native unit tests

Test:

- JSONL encoding/decoding;
- command validation;
- exactly-one direct response per command;
- acknowledgement and rejection correlation;
- runtime state transitions;
- ring-buffer wraparound;
- overflow behavior;
- audio conversion;
- float range handling;
- event sequencing;
- transcript-delta emission;
- stop/finalize ordering;
- cancel behavior;
- EOU/EOB mapping;
- stdout purity;
- shutdown from every state.

Use an engine interface so most runtime tests can use a fake transcription engine without loading the real model.

### 22.3 Native integration tests

Add an internal fixture mode:

```bash
talk-to-pi-runtime \
  --stdio \
  --model <model> \
  --test-audio test/fixtures/de-coding.wav
```

The mode should feed fixture PCM through the same streaming path used by microphone audio.

Integration assertions:

- process emits `hello`;
- model loads;
- start succeeds;
- stable deltas are emitted;
- final text equals concatenated/reconciled output;
- final event occurs exactly once;
- runtime returns to ready;
- a second session works without reloading the model;
- shutdown is clean.

### 22.4 TUI tests

Test the overlay and handoff as a stateful flow:

- provisioning progress;
- runtime loading;
- live append-only rendering;
- Unicode and German punctuation;
- terminal resizing;
- narrow terminal;
- Enter from recording;
- Esc from recording;
- finalization transition;
- leading/trailing whitespace trimming;
- empty-transcript handling;
- regular-editor prefill via `ctx.ui.setEditorText()`;
- runtime error with partial-text handoff;
- focus restoration;
- no call to `pi.sendUserMessage()` and no accidental submit.

### 22.5 End-to-end tests

Use a fake runtime executable in CI to test:

```text
Pi extension
  ↔ child process
  ↔ JSONL events
  ↔ overlay result
  ↔ setEditorText call
```

Real-model CI may be too heavy for every pull request. Use two tiers:

**Normal PR CI**

- fake runtime;
- all TypeScript tests;
- native unit tests;
- runtime build;
- small protocol smoke test.

**Scheduled or release CI**

- download the pinned model;
- verify checksum;
- run real English and German fixture transcriptions;
- record timings;
- verify offline operation after download.

### 22.6 Manual test matrix

MVP platforms:

- Ubuntu 22.04 LTS x86_64;
- Ubuntu 24.04 LTS x86_64;
- Debian 12 x86_64.

Audio environments:

- PipeWire with PulseAudio compatibility;
- PulseAudio;
- direct ALSA fallback;
- USB microphone;
- laptop microphone;
- no microphone;
- microphone in use by another process.

Terminal environments:

- GNOME Terminal;
- Kitty;
- WezTerm;
- Ghostty;
- tmux;
- SSH with local/remote audio limitation documented.

### 22.7 Privacy tests

After assets are installed:

1. block outbound networking;
2. start Pi;
3. run `/talk`;
4. record and submit;
5. confirm local transcription still works;
6. confirm no audio or transcript files appear in managed directories;
7. inspect default logs for transcript leakage.

---

## 23. Performance and Quality Gates

Do not promise performance before measuring on named hardware.

Establish at least two reference systems:

```text
Reference A: modern 8-core x86_64 laptop CPU
Reference B: older 4-core x86_64 laptop CPU
```

Record:

- model load time;
- resident memory;
- real-time factor;
- first visible transcript-delta latency;
- finalization latency;
- CPU utilization;
- dropped audio frames;
- German and English word error observations;
- runtime archive size;
- model size.

Initial targets on Reference A:

| Metric | Target |
|---|---|
| Streaming real-time factor | `< 1.0` |
| First visible stable text | `< 2.0 s` after speech begins |
| Finalization after Enter | `< 750 ms` |
| UI update after runtime event | `< 100 ms` |
| Dropped audio frames | `0` |
| Model loaded once per Pi session | yes |
| Network required after setup | no |
| Audio files created | none |

Treat these as engineering targets, not public guarantees until repeatable measurements exist.

For Q8_0, run a small acceptance corpus focused on coding dictation:

- file paths;
- CLI flags;
- framework names;
- camelCase identifiers spoken naturally;
- German sentences with English technical terms;
- punctuation and capitalization;
- corrections after pauses.

No cleanup model exists in the MVP, so raw ASR quality must be evaluated honestly.

---

## 24. CI and Release Engineering

### 24.1 Pull-request CI

`ci.yml`:

- install Node dependencies with scripts disabled;
- lint;
- format check;
- type-check;
- run TypeScript unit/integration tests;
- configure CMake;
- build portable Linux x64 CPU runtime;
- run native unit tests;
- run fake-engine protocol tests;
- verify generated docs/manifests are current;
- run license-file checks;
- scan for accidental large files;
- ensure stdout-protocol tests pass.

### 24.2 Native release workflow

`native-release.yml` on dedicated runtime tags such as `runtime-v0.1.0`:

1. checkout submodules at pinned commits;
2. build `linux-x64-cpu` with portable settings;
3. run native tests;
4. run real-model release integration tests;
5. strip binary where appropriate;
6. package runtime and required shared libraries, if any;
7. include third-party notices;
8. calculate SHA-256;
9. generate SBOM;
10. upload release archive and checksum file under the immutable runtime tag;
11. publish a generated manifest fragment containing the immutable URL, size, and hash for the follow-up manifest commit;
12. attach benchmark results.

Prefer a mostly static artifact, but do not statically link system libraries in a way that creates licensing or compatibility problems. Test the release tarball inside clean Ubuntu and Debian containers.

### 24.3 npm release workflow

Publish npm only after runtime release assets exist.

Release order:

1. tag the tested native commit as `runtime-v0.1.0`;
2. build and publish the native release asset and checksums under that immutable runtime tag;
3. update and commit `manifests/runtime-v1.json` with the immutable runtime URL, exact size, and SHA-256;
4. verify the already-pinned model manifest and run isolated provisioning/install smoke tests from the release commit;
5. tag that manifest-bearing commit as project release `v0.1.0`;
6. publish the npm package from the project tag without modifying generated content;
7. verify `pi install` from npm and first-use provisioning;
8. create GitHub release notes.

Never move either tag or mutate a published asset. The project tag must point to the exact manifest shipped in the npm tarball; runtime artifacts are therefore released and hashed before the project/npm tag is created.

Use npm trusted publishing/OIDC if available.

### 24.4 Versioning

Use semantic versioning.

Maintain separate versions:

- package version;
- runtime version;
- protocol version;
- model manifest version.

Compatibility rules:

- patch package releases may reuse a compatible runtime;
- runtime protocol breaking changes require a protocol-version increment;
- model changes require a model-manifest revision and release notes;
- the extension must reject unsupported runtime protocol versions clearly.

---

## 25. Development Milestones

## Milestone 0 — Repository and Dependency Spike

**Goal:** prove every critical upstream integration before building product UI.

Tasks:

1. Create the GitHub repository `talk-to-pi`.
2. Add MIT license and initial README.
3. Add this plan as `DEVELOPMENT_PLAN.md`.
4. Initialize TypeScript, Vitest, linting, and formatting.
5. Pin a minimum Pi version.
6. Build a trivial Pi extension registering `/talk`.
7. Prove `ctx.ui.custom()` overlay behavior.
8. Prove that an overlay result can be trimmed and transferred to Pi's regular prompt editor with `ctx.ui.setEditorText()` after the overlay closes.
9. Verify that the handoff preserves the user's configured Pi editor component and does not submit automatically.
10. Pin `parakeet.cpp`.
11. Pin miniaudio.
12. Pin nlohmann/json and record its license.
13. Build a tiny native executable linked to parakeet.cpp.
14. Load the candidate Nemotron GGUF.
15. Feed a fixture in 100 ms chunks.
16. Verify German streaming output.
17. Verify the model license and derivative artifact provenance.
18. Record the exact C API ABI version.
19. Write Architecture Decision Records for the chosen model artifact and native packaging.

**Exit criteria:**

- `/talk` opens a test overlay;
- a hard-coded overlay result is placed in Pi's regular prompt editor without being submitted;
- the native prototype emits stable deltas from a German fixture;
- the selected stock-compatible Q8_0 artifact is pinned by hash;
- licensing notes are complete enough to proceed.

Do not begin full UI work before this milestone passes.

---

## Milestone 1 — Native Runtime Skeleton

**Goal:** create a deterministic, testable child process without microphone capture.

Tasks:

1. Implement JSONL protocol reader/writer.
2. Reserve stdout exclusively for protocol output.
3. Add `hello`, `loading_model`, `ready`, `pong`, `command_ack`, `error`, and `shutdown_complete`.
4. Implement exactly-one correlated response handling for every command.
5. Implement runtime state machine.
6. Wrap parakeet model lifecycle.
7. Wrap streaming-session lifecycle.
8. Add fixture-audio injection.
9. Emit stable `transcript_delta` events.
10. Emit authoritative `recording_finalized` and explicit `recording_cancelled` events.
11. Forward EOU/EOB events.
12. Add fake-engine tests.
13. Add real-model integration test.
14. Add `--version` and `--self-test`.

**Exit criteria:**

- two sequential fixture sessions work in one process;
- the model loads only once;
- all stdout lines are valid protocol JSON;
- cancel, stop, and shutdown are deterministic;
- native unit tests pass under sanitizers in a debug build.

---

## Milestone 2 — Live Microphone Capture

**Goal:** replace fixture input with a reliable local microphone stream.

Tasks:

1. Integrate miniaudio.
2. Enumerate the default capture device.
3. Request 16 kHz mono float PCM.
4. Add conversion/resampling fallback.
5. Implement bounded ring buffer.
6. Implement inference worker.
7. Add capture start/stop/cancel.
8. Detect and report overflow.
9. Add optional low-rate audio-level events.
10. Test repeated sessions.
11. Test device-unavailable behavior.
12. Test shutdown during capture.
13. Confirm that no audio is written to disk.

**Exit criteria:**

- live speech produces stable deltas;
- recording stops cleanly;
- zero dropped frames on Reference A;
- cancel closes the microphone immediately;
- five repeated sessions work without process restart;
- no audio artifacts remain after exit.

---

## Milestone 3 — Pi Runtime Manager and Protocol Client

**Goal:** make Pi own the native process reliably.

Tasks:

1. Implement typed protocol schemas.
2. Implement incremental stdout parser.
3. Implement stderr ring log.
4. Implement command correlation.
5. Implement session-ID filtering.
6. Implement readiness promise.
7. Implement state and sequence validation.
8. Implement graceful shutdown escalation.
9. Register `session_start`.
10. Register `session_shutdown`.
11. Handle `/reload`.
12. Implement one pre-recording restart attempt.
13. Add fake-runtime integration tests.
14. Add `/talk-doctor` base diagnostics.

**Exit criteria:**

- Pi starts and stops the runtime cleanly;
- reload leaves no orphan processes;
- old-session events cannot mutate a new UI;
- runtime crashes are reported without crashing Pi;
- fake-runtime tests cover all protocol terminal states.

---

## Milestone 4 — Talk Overlay and Prompt-Editor Handoff

**Goal:** deliver the complete record-to-regular-editor user flow.

Tasks:

1. Register `/talk`.
2. Reject non-TUI mode.
3. Reject busy Pi state.
4. Build overlay shell and theme integration.
5. Show runtime loading.
6. Start recording automatically.
7. Render stable transcript deltas.
8. Implement Enter-to-stop.
9. Implement Esc-to-discard.
10. Show finalizing state.
11. Reconcile authoritative final text.
12. Trim leading and trailing transcript whitespace.
13. Close the overlay with the transcript as its result.
14. Transfer the result with `ctx.ui.setEditorText()`.
15. Restore focus to Pi's regular prompt editor.
16. Verify that Talk-to-Pi never calls `pi.sendUserMessage()`.
17. Preserve and hand off text on recoverable runtime failure.
18. Test resize and Unicode.
19. Add user-facing notifications.

**Exit criteria:**

- one `/talk` command completes the full record-to-prompt-editor flow;
- the final transcript appears in Pi's regular editor;
- Talk-to-Pi never submits text;
- Esc during the overlay never changes or submits the prompt editor;
- already-shown text survives a simulated runtime crash;
- normal Pi editor behavior remains unchanged in the supported terminal matrix.

---

## Milestone 5 — Managed Provisioning

**Goal:** make installation work without manual native or model setup.

Tasks:

1. Define runtime manifest schema.
2. Define model manifest schema.
3. Implement XDG paths.
4. Implement lock files.
5. Implement streamed download with progress.
6. Implement exact-size checks.
7. Implement SHA-256 checks.
8. Implement safe archive extraction with entry allowlisting and traversal/link rejection.
9. Implement atomic installation.
10. Implement stale/corrupt asset repair.
11. Add first-use setup overlay.
12. Add model source/license disclosure.
13. Start installed runtime automatically on later Pi sessions.
14. Extend `/talk-doctor`.
15. Test concurrent first-use processes.
16. Test interrupted downloads.
17. Test offline subsequent use.

**Exit criteria:**

- clean-machine first use succeeds from npm installation;
- no compilation tools are required;
- corrupt downloads are never executed;
- concurrent Pi processes do not corrupt installation;
- subsequent use works offline.

---

## Milestone 6 — Hardening and `v0.1.0`

**Goal:** prepare a trustworthy public release.

Tasks:

1. Complete README.
2. Complete architecture, protocol, licensing, security, and troubleshooting docs.
3. Add third-party notices.
4. Add English and German fixture tests.
5. Run performance benchmark matrix.
6. Fix leaks under repeated sessions.
7. Run AddressSanitizer/UndefinedBehaviorSanitizer builds.
8. Test clean Ubuntu and Debian systems.
9. Test tmux and major terminals.
10. Audit default logs for transcript leakage.
11. Generate SBOM.
12. Build release asset.
13. Verify release asset in a clean container.
14. Perform npm pack smoke test.
15. Publish release candidate.
16. Run manual acceptance checklist.
17. Publish `v0.1.0`.

**Exit criteria:**

- all Definition of Done items pass;
- known limitations are documented;
- runtime and model hashes are immutable;
- code and model licenses are clearly separated;
- no orphan process or audio-device lock remains after Pi exit.

---

## 26. GitHub Issue Breakdown

Create the following initial issues and link them to milestones.

### Repository

- `repo: bootstrap TypeScript Pi extension package`
- `repo: add MIT license and third-party notice structure`
- `repo: configure CI, formatting, type-checking, and tests`
- `repo: add contribution and security policies`

### Upstream spikes

- `spike: verify Pi recording overlay and regular-editor handoff`
- `spike: verify setEditorText preserves configured editor behavior without submitting`
- `spike: pin parakeet.cpp ABI and build integration`
- `spike: pin nlohmann/json and verify native protocol integration`
- `spike: select and license-audit stock Nemotron Q8_0 GGUF`
- `spike: verify German cache-aware streaming fixture`

### Native runtime

- `runtime: implement JSONL protocol`
- `runtime: implement model lifecycle`
- `runtime: implement streaming session lifecycle`
- `runtime: implement fixture input mode`
- `runtime: integrate miniaudio capture`
- `runtime: implement ring buffer and inference worker`
- `runtime: forward transcript and speech events`
- `runtime: add self-test and diagnostics`
- `runtime: add unit and real-model integration tests`

### Extension runtime management

- `extension: implement managed paths`
- `extension: implement runtime process manager`
- `extension: implement typed protocol client`
- `extension: implement Pi lifecycle cleanup`
- `extension: implement runtime crash handling`
- `extension: implement /talk-doctor`

### UI

- `ui: implement Talk-to-Pi overlay shell`
- `ui: implement live stable transcript view`
- `ui: implement stop/finalize flow`
- `ui: hand final transcript to Pi's regular prompt editor`
- `ui: restore prompt-editor focus without submitting`
- `ui: preserve partial text on failure`
- `ui: test resize, Unicode, configured-editor preservation, and narrow terminals`

### Provisioning

- `provisioning: define immutable checksummed asset manifests`
- `provisioning: implement runtime download and install`
- `provisioning: implement model download and install`
- `provisioning: implement locking and atomic repair`
- `provisioning: build first-use progress UI`
- `provisioning: test offline subsequent use`

### Release

- `release: build linux-x64-cpu runtime artifact`
- `release: create SBOM and checksums`
- `release: validate clean-system installation`
- `release: publish npm release candidate`
- `release: complete v0.1.0 acceptance checklist`

---

## 27. Definition of Done for `v0.1.0`

The MVP is complete only when all items below are true.

### Installation

- [ ] Package installs through Pi from npm.
- [ ] No npm lifecycle script is required.
- [ ] First `/talk` provisions runtime and model automatically.
- [ ] Download progress is visible.
- [ ] Every downloaded executable/model is checksum-verified.
- [ ] Subsequent use works offline.

### Runtime

- [ ] One native child process is managed by the extension.
- [ ] No server port is opened.
- [ ] The model loads once per Pi session.
- [ ] Microphone capture is local.
- [ ] Audio is never written to disk.
- [ ] parakeet.cpp streaming uses a pinned ABI.
- [ ] German and English fixtures pass.
- [ ] Repeated recordings do not leak resources.
- [ ] Pi exit and reload leave no orphan process.

### User experience

- [ ] `/talk` opens a focused overlay.
- [ ] Recording begins with a visible indicator.
- [ ] Stable text appears incrementally.
- [ ] Enter stops and finalizes.
- [ ] The transcript is placed into Pi's regular prompt editor and becomes editable.
- [ ] Submission occurs only through an explicit action in Pi's regular editor.
- [ ] Escape during the recording overlay discards without changing or submitting the prompt editor.
- [ ] Talk-to-Pi has no auto-submit path.
- [ ] A recoverable runtime error preserves visible text.
- [ ] Busy-agent behavior is clear.
- [ ] Non-TUI behavior is clear.

### Security and privacy

- [ ] No telemetry exists.
- [ ] No audio file exists after a session.
- [ ] Default logs contain no transcript.
- [ ] Runtime downloads are immutable and hashed.
- [ ] Model provenance is documented.
- [ ] Code and model licenses are clearly separated.
- [ ] Offline test passes after provisioning.

### Documentation

- [ ] README contains quick start and privacy boundaries.
- [ ] Architecture is documented.
- [ ] Protocol is documented.
- [ ] Troubleshooting covers microphone and model issues.
- [ ] Licensing documentation is complete.
- [ ] Known limitations are explicit.

---

## 28. Risk Register

| Risk | Impact | Mitigation |
|---|---|---|
| Q8_0 model artifact is incompatible with pinned parakeet.cpp | Release blocker | Validate the generated artifact with real streaming fixtures; pin hashes and converter provenance |
| Model derivative licensing is ambiguous | Release blocker | Perform artifact-specific license audit; preserve OpenMDW and origin notices; do not publish until resolved |
| CPU cannot maintain real time on older hardware | Poor UX | Benchmark early; publish minimum recommendations; optimize threads/chunk handling; avoid claiming universal performance |
| Stable deltas arrive less frequently than expected | UI feels laggy | Measure on target model; keep status/audio indicator responsive; do not fake unstable partials |
| Linux audio backend fails on some systems | Setup failures | Use miniaudio; test PipeWire/Pulse/ALSA; provide `/talk-doctor`; document container/SSH limitations |
| Audio callback blocks | Dropouts | Callback only writes to bounded ring buffer; inference on worker thread |
| Runtime crashes Pi through FFI | Severe | Use child-process isolation, not FFI |
| Orphan runtime after reload | Resource leak | Lifecycle-aware idempotent shutdown; process ownership; integration tests |
| Large first-use download surprises users | Friction | Download on first `/talk`, show exact size and progress, never silently at install |
| Partial download corruption | Broken setup | Hashing, temp files, atomic rename, locking |
| Transcript appears in logs | Privacy failure | Redact protocol payloads; no transcript logging by default; privacy tests |
| Transcript handoff loses prompt-editor content | Lost draft | Capture existing editor text before recording and append the finalized transcript rather than overwriting it |
| Pi API changes before release | Build/runtime breakage | Pin minimum/tested version; use public APIs only; CI against supported Pi versions |
| Multiple Pi instances consume substantial RAM | Resource pressure | Document one runtime per Pi process; shared daemon explicitly deferred |
| Existing voice extension reduces differentiation | Positioning risk | Lead with Nemotron/parakeet cache-aware streaming, stable deltas, and narrow managed runtime |

---

## 29. Post-MVP Backlog

Only consider these after `v0.1.0` is stable:

1. Linux arm64 CPU runtime.
2. CUDA runtime asset.
3. Vulkan runtime asset.
4. macOS Metal support.
5. Windows support.
6. Microphone picker.
7. Configurable shortcut.
8. Optional auto-stop on EOU.
9. Pause/resume.
10. Append another recording to the same editor.
11. Per-project language setting.
12. User dictionary or deterministic replacements.
13. Shared runtime process for multiple Pi sessions.
14. Optional raw/cleaned comparison workflow.
15. Optional cleanup model.
16. Optional external backend protocol.
17. Audio-file transcription command.
18. Accessibility and localization.
19. Runtime/model update command.
20. Performance dashboard.

Do not design the MVP around these future features. Add them only when a concrete user need justifies the extra surface.

---

## 30. Coding-Agent Execution Rules

A coding agent implementing this plan should follow these rules:

1. Work milestone by milestone.
2. Do not broaden the product scope.
3. Treat the locked decisions as architectural constraints.
4. Verify current upstream APIs before coding against them.
5. Pin every native dependency and model artifact.
6. Add tests in the same change as behavior.
7. Keep `docs/PROTOCOL.md` synchronized with protocol code.
8. Keep model/runtime manifests generated and reproducible.
9. Never log transcript content by default.
10. Never add an npm install script.
11. Never start a network listener.
12. Never silently submit text.
13. Preserve user-visible text on errors.
14. Prefer small, reviewable pull requests.
15. Record non-obvious decisions in ADRs.
16. Run the full relevant test suite before each milestone is considered complete.
17. Stop and open an issue when model licensing or provenance is uncertain.
18. Do not replace the Pi core editor globally.
19. Do not add a backend interface “for future flexibility.”
20. Optimize only after measuring the native streaming path.

Suggested implementation branch sequence:

```text
feat/repo-bootstrap
spike/pi-overlay-handoff
spike/nemotron-parakeet
feat/runtime-protocol
feat/runtime-streaming
feat/runtime-microphone
feat/extension-runtime-manager
feat/talk-overlay
feat/managed-provisioning
chore/release-hardening
```

---

## 31. Initial README Copy

A concise initial project description:

> **Talk-to-Pi** adds fully local, live voice input to the Pi Coding Agent. Run `/talk`, speak, watch Nemotron transcribe in real time, then edit the result in Pi's regular prompt editor and press Enter to send. Talk-to-Pi manages its own native parakeet.cpp runtime and model—no cloud speech API, server, Python environment, or system service required.

Initial feature list:

- Local Nemotron 3.5 streaming ASR
- Managed parakeet.cpp runtime
- Live stable transcript
- Editable before sending
- Explicit submit or discard
- No cloud audio
- No telemetry
- Offline after first setup
- Linux x86_64 CPU first

Required qualification:

> Audio transcription is local. Submitted transcript text is handled by Pi and its configured model provider in the normal way.

---

## 32. Primary References

Re-verify versions and details at implementation time.

- Pi repository: <https://github.com/earendil-works/pi>
- Pi extension documentation: <https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md>
- Pi TUI documentation: <https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/tui.md>
- parakeet.cpp: <https://github.com/mudler/parakeet.cpp>
- parakeet.cpp C API: <https://github.com/mudler/parakeet.cpp/blob/master/include/parakeet_capi.h>
- NVIDIA Nemotron 3.5 ASR Streaming model card: <https://huggingface.co/nvidia/nemotron-3.5-asr-streaming-0.6b>
- miniaudio: <https://github.com/mackron/miniaudio>
- OpenMDW 1.1 model license: use the exact copy linked by the chosen official model artifact
- Local Pi voice landscape reference: <https://www.npmjs.com/package/@juicesharp/rpiv-voice>

---

## 33. Final Recommendation

Proceed with `Talk-to-Pi` as the repository and product name.

Build `v0.1.0` around one strong vertical slice:

```text
/talk
  → managed runtime ready
  → microphone capture
  → parakeet.cpp + Nemotron streaming
  → stable live transcript
  → trim and close the overlay
  → Pi's regular prompt editor
  → user edits and submits normally
```

The product should remain intentionally boring around that path. Reliability, local privacy, clean lifecycle management, and seamless reuse of Pi's regular terminal editor are more valuable than backend flexibility for the first release.
