# Talk-to-Pi

Local voice input for the [Pi coding agent](https://github.com/earendil-works/pi-mono), powered by NVIDIA NeMo-Speech.cpp and Nemotron 3.5 ASR Streaming.

Talk-to-Pi records your microphone locally, shows the live transcript, and places the final text in Pi's normal prompt editor. Nothing is submitted automatically.

## Features

- Local streaming speech-to-text
- Multilingual Nemotron 3.5 ASR with automatic language detection
- Live transcript in a focused Pi overlay
- Dictation while the Pi agent is working
- Existing editor text is preserved when dictation is inserted
- Non-blocking model download with progress below the editor
- Automatic native-runtime recovery after recording failures
- Configurable shortcut, language, and model prewarming
- CPU runtime for Linux x86_64 and optional NVIDIA CUDA build
- No cloud speech service, telemetry, audio persistence, or automatic prompt submission

## Requirements

- Linux x86_64
- Node.js `>=24.0.0`
- Pi coding agent
- Git with submodule support
- CMake `>=3.26`
- C++17 compiler

The speech model download is approximately 742 MB and requires confirmation on first use.

## Installation

Clone the repository with its native dependencies:

```bash
git clone --recurse-submodules https://github.com/Danmoreng/talk-to-pi.git
cd talk-to-pi
npm ci
npm run install:local:pi
```

The installation command builds the TypeScript package and native CPU runtime, then installs the checkout as a global Pi package. At the end it prints an environment setting similar to:

```bash
export TALK_TO_PI_RUNTIME_PATH=/absolute/path/to/talk-to-pi/native/build/talk-to-pi-runtime
```

Add that line to your shell profile, restart the shell, and launch Pi normally:

```bash
pi
```

For a project-local Pi installation, build first and then use:

```bash
npm run build
npm run native:build
pi install -l "$PWD"
```

## Usage

Press `Alt+R` or run:

```text
/talk
```

The recording flow is:

1. Speak while the live transcript is displayed.
2. Press `Enter` to stop and finalize.
3. Edit the resulting text in Pi's regular editor.
4. Submit it normally when ready.

Press `Esc` to discard a recording.

On first use, Talk-to-Pi asks before downloading the pinned NVIDIA model. The download runs in the background, displays progress below Pi's editor, and does not prevent normal work. Start `/talk` again after the ready notification.

### Language override

Use automatic detection by default, or select a language for one recording:

```text
/talk --lang de-DE
/talk --lang en-US
/talk --lang auto
```

## Configuration

Run `/talk-config` inside Pi to edit the persistent configuration. It is stored at `~/.config/talk-to-pi/config.json`, or the corresponding XDG config path.

```json
{
  "shortcut": "alt+r",
  "language": "auto",
  "prewarm": false
}
```

- `shortcut`: recording shortcut; set to `null` to disable it
- `language`: `auto`, `system`, or a supported locale such as `de-DE`
- `prewarm`: load the native runtime at Pi startup for lower first-recording latency

Saving through `/talk-config` validates the file and reloads the extension automatically.

## Commands

| Command                 | Description                                        |
| ----------------------- | -------------------------------------------------- |
| `/talk`                 | Start voice input                                  |
| `/talk --lang <locale>` | Start voice input with a one-off language          |
| `/talk-config`          | Edit persistent settings                           |
| `/talk-doctor`          | Show configuration, asset, and runtime diagnostics |

## Optional CUDA build

On a supported NVIDIA Linux system:

```bash
cmake -S native -B native/build-cuda -G Ninja \
  -DCMAKE_BUILD_TYPE=Release \
  -DTALK_TO_PI_ENABLE_CUDA=ON
cmake --build native/build-cuda -j"$(nproc)"
```

Use the resulting runtime with:

```bash
export TALK_TO_PI_RUNTIME_PATH="$PWD/native/build-cuda/talk-to-pi-runtime"
```

## Updating

```bash
git pull

git submodule update --init --recursive
npm ci
npm run install:local:pi
```

Restart Pi or run `/reload` after updating.

## Privacy

Microphone audio is handled by the local native runtime and is not uploaded by Talk-to-Pi. Transcripts are not logged or stored separately. Once you submit text from Pi's editor, it follows Pi's configured model-provider behavior.

## Development

```bash
npm ci
npm run typecheck
npm test
npm run build
npm run format:check
npm run native:build
npm run native:test
```

Architecture and protocol details are available in [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) and [`docs/PROTOCOL.md`](./docs/PROTOCOL.md).

## License

Talk-to-Pi is MIT licensed. NVIDIA NeMo-Speech.cpp, the Nemotron model, and other dependencies retain their respective licenses. See [`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md) and [`docs/LICENSING.md`](./docs/LICENSING.md).
