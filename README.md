# Talk-to-Pi

Local, live Nemotron dictation for the Pi Coding Agent.

> **Development status:** Talk-to-Pi is currently under active development. The native runtime and model provisioning are not yet released.

The planned user flow is:

```text
/talk → speak → watch the local transcript → stop → edit in Pi's regular prompt editor → submit normally
```

Talk-to-Pi is designed for Linux x86_64 CPU inference. Microphone audio is processed locally and is not uploaded by Talk-to-Pi. After the user submits the transcript, the text follows Pi's normal model-provider behavior.

## Development

Requirements:

- Node.js `>=22.19.0`
- CMake `>=3.24`
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

Load the extension during development with Pi:

```bash
pi -e ./dist/index.js
```

The `/talk-doctor` command reports the current asset and process state. `/talk` intentionally refuses to start until the pinned runtime and model have been provisioned.

## Scope

The MVP uses one managed `parakeet.cpp` child process, miniaudio microphone capture, Nemotron 3.5 ASR Streaming 0.6B, and JSONL over stdin/stdout. It does not use a cloud speech API, a server, Python, an npm lifecycle script, telemetry, or automatic submission.

See [`DEVELOPMENT_PLAN.md`](./DEVELOPMENT_PLAN.md) for the complete implementation plan and [`docs/PROTOCOL.md`](./docs/PROTOCOL.md) for the native IPC contract.
