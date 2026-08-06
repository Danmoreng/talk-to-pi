# Talk-to-Pi development plan

## Product goal

Talk-to-Pi provides private, local speech-to-text input for the Pi coding agent.
It records from the default microphone, displays live transcription in a focused
overlay, and returns finalized text to Pi's normal prompt editor without
submitting it automatically.

## Supported release target

The first release targets Linux x86_64 with CPU inference. CUDA remains an
optional developer build until a separately verified runtime artifact is
published. macOS, Windows, device selection, cloud ASR, telemetry, and automatic
prompt submission are outside the initial scope.

## Fixed architecture

- Pi extension written in TypeScript;
- one managed native child process;
- JSONL protocol over stdin/stdout;
- miniaudio default-device capture at 16 kHz mono float PCM;
- NVIDIA NeMo-Speech.cpp C API;
- NVIDIA Nemotron 3.5 ASR Streaming 0.6B Q8_0 model;
- no Node FFI and no network listener.

The engine and model decision is recorded in
[`docs/adr/0001-talk-to-pi-asr-engine.md`](./docs/adr/0001-talk-to-pi-asr-engine.md).

## Package and installation strategy

Pi loads the extension directly from `src/index.ts`. Generated `dist/` output
is a local build artifact and is not committed. This allows both npm packages
and Git-installed Pi packages to use the same checked-in TypeScript source.

Native binaries are never built from npm install hooks. During development, a
user explicitly initializes submodules and runs `npm run native:build`. A public
binary release must use immutable release URLs, exact byte sizes, and SHA-256
verification through `manifests/runtime-v1.json`.

The NVIDIA model is downloaded only after explicit first-use consent and is
verified against `manifests/model-v1.json` before use. Provisioning runs in the
background with a non-blocking editor widget and completion notification.

## Persistent configuration

User configuration lives at the XDG config path
`talk-to-pi/config.json` and is edited with `/talk-config`. Initial fields are:

- `shortcut`: configurable key or `null`; default `alt+r`;
- `language`: `auto`, `system`, or a supported locale;
- `prewarm`: opt-in model loading at Pi session startup.

Configuration changes are validated before being written and take effect after
extension reload.

## Runtime reliability requirements

- a recording emits one terminal outcome;
- warnings such as audio-buffer overflow do not masquerade as terminal errors;
- terminal runtime/protocol failures tear down and restart the child process;
- the next `/talk` waits for an in-progress restart rather than using stale
  process state;
- shutdown escalates from protocol shutdown to SIGTERM and SIGKILL;
- no transcript or audio is written to logs or files;
- partial text may be handed to the editor with an explicit warning.

## Release gates

### Source repository

- all submodule commits fetch from their configured public upstream URLs;
- clean recursive clone builds without local-only commits;
- TypeScript source entry works with `pi install` from a Git checkout;
- licenses, NVIDIA NOTICE, security policy, and third-party notices are present;
- CI runs typecheck, tests, build, formatting, and native tests.

### Native runtime artifact

- release build uses portable CPU settings;
- archive includes executable and applicable third-party notices;
- archive is tested in clean supported Linux environments;
- immutable GitHub release URL, size, and SHA-256 are committed to the runtime
  manifest;
- provisioning and checksum-failure paths have integration coverage.

### Product validation

- German coding-dictation corpus;
- repeated recordings in one warmed process;
- microphone failure and recovery;
- audio overflow behavior;
- cancel during provisioning, startup, recording, and finalization;
- runtime crash and automatic restart;
- clean installation from Git and from the packed npm artifact;
- CPU latency, memory, WER/CER, and transcript-revision report.

## Required checks

```bash
npm ci
npm run typecheck
npm test
npm run build
npm run format:check
npm run native:build
npm run native:test
npm pack --dry-run
```

## Release sequence

1. Complete the source and product validation gates.
2. Build and publish the immutable native runtime archive.
3. Update and verify `manifests/runtime-v1.json`.
4. Test a clean Git installation and the exact npm tarball.
5. Tag the manifest-bearing source commit.
6. Publish the npm package and GitHub release from that tag.

Do not publish an npm release while the runtime manifest has no supported
artifact. The GitHub source repository may be published earlier as a clearly
marked development release.
