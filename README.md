# Talk-to-Pi

Local, live Nemotron dictation for the Pi Coding Agent.

> **Development status:** The local Linux x86_64 NeMo-Speech.cpp development path is usable. Release provisioning is still gated until a verified native runtime archive is published.

The user flow is:

```text
Ctrl+R or /talk → speak → watch the local transcript → stop → edit in Pi's regular prompt editor → submit normally
```

Talk-to-Pi registers `Ctrl+R` as a Pi extension shortcut. While the extension is
loaded, it takes precedence over Pi's default session-rename shortcut.

Talk-to-Pi is designed for Linux x86_64 CPU inference. Microphone audio is processed locally and is not uploaded by Talk-to-Pi. After the user submits the transcript, the text follows Pi's normal model-provider behavior.

## Development

Requirements:

- Node.js `>=22.19.0`
- CMake `>=3.26`
- C++17 compiler
- Git with submodule support

```bash
npm install
npm run typecheck
npm test
npm run build
npm run format:check
```

Build the native runtime after initializing dependencies:

```bash
git submodule update --init --recursive
node scripts/build-native.mjs
```

Build and run the local CPU development path with Pi:

```bash
npm run build
npm run native:build
npm run local:pi
```

An experimental CUDA runtime can be built separately on an NVIDIA Linux host:

```bash
cmake -S native -B native/build-cuda -G Ninja \
  -DCMAKE_BUILD_TYPE=Release -DTALK_TO_PI_ENABLE_CUDA=ON
cmake --build native/build-cuda -j"$(nproc)"
TALK_TO_PI_RUNTIME_PATH="$PWD/native/build-cuda/talk-to-pi-runtime" \
npm run local:pi
```

The default remains CPU. The NeMo runtime uses the official NVIDIA Q8_0 model
from the pinned Hugging Face snapshot and selects the CUDA backend only in the
CUDA build.

`scripts/local-pi.sh` uses the locally built NeMo runtime in `native/build`.
The first `/talk` asks for permission to download the official model into the
Hugging Face cache. Override the runtime with `TALK_TO_PI_RUNTIME_PATH` when
needed; do not set the old parakeet model override. Then use `/talk`, press
Enter to stop, and submit the resulting text through Pi normally. Existing
prompt text is preserved and the new transcript is appended with a separating
space. Language detection defaults to `auto`; set `TALK_TO_PI_LANGUAGE=de-DE`
(or another supported locale) for a user-wide default, or use
`/talk --lang en-US` for a one-off override.

The `/talk-doctor` command reports the current asset and process state. Release
provisioning remains gated until a stable, verified native runtime archive is
published.

### Install for normal Pi sessions

Publishing to npm is not required for local use. After building the local
runtime and model, install this repository as a global Pi package once:

```bash
npm run install:local:pi
```

The script runs `pi install` with the repository path and prints the local
runtime environment variable. Add that export to your shell profile, then
start Pi normally with `pi`; the extension will be loaded automatically in all
sessions. The first `/talk` asks permission to download the official NVIDIA
model into the Hugging Face cache. Use `pi install -l "$PWD"` instead if it
should be project-local.

## Scope

The MVP uses one managed `NeMo-Speech.cpp` child process, miniaudio microphone capture, Nemotron 3.5 ASR Streaming 0.6B, and JSONL over stdin/stdout. It does not use a cloud speech API, a server, Python, an npm lifecycle script, telemetry, or automatic submission.

See [`DEVELOPMENT_PLAN.md`](./DEVELOPMENT_PLAN.md) for the complete implementation plan and [`docs/PROTOCOL.md`](./docs/PROTOCOL.md) for the native IPC contract.
