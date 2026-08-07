# Talk-to-Pi

Local voice input for the [Pi coding agent](https://github.com/earendil-works/pi-mono), powered by NVIDIA NeMo-Speech.cpp and Nemotron 3.5 ASR Streaming.

Talk-to-Pi records your microphone locally, shows the live transcript, and places the final text in Pi's normal prompt editor. Nothing is submitted automatically.

## Features

- Local streaming speech-to-text
- Multilingual Nemotron 3.5 ASR with automatic language detection
- Live transcript in a focused Pi overlay
- Dictation while the Pi agent is working
- Existing editor text is preserved when dictation is inserted
- Non-blocking runtime and model downloads with visible progress
- Automatic native-runtime recovery after recording failures
- Configurable shortcut, language, and model prewarming
- CPU runtimes for Linux, macOS, and Windows
- No cloud speech service, telemetry, audio persistence, or automatic prompt submission

## Requirements

- Node.js `>=24.0.0`
- Pi coding agent
- Approximately 742 MB for the speech model
- A supported CPU platform:
  - Linux x64 with AVX2/FMA/F16C/BMI2, or Linux ARM64
  - macOS 13 or later on Intel with AVX2, or Apple Silicon
  - Windows 10/11 x64 with AVX2

Pi on Windows runs in Git Bash. Linux release binaries target Ubuntu 24.04 or a distribution with a compatible glibc and C++ runtime.

## Installation

Install the package through Pi:

```bash
pi install npm:talk-to-pi
```

Restart Pi or run `/reload` after installation.

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

On first use, Talk-to-Pi asks before downloading the pinned native runtime and NVIDIA model. Provisioning runs in the background, displays progress below Pi's editor, and does not prevent normal work. Start `/talk` again after the ready notification.

### Language override

Use automatic detection by default, or select a language for one recording:

```text
/talk --lang de-DE
/talk --lang en-US
/talk --lang auto
```

## Configuration

Run `/talk-config` inside Pi to edit the persistent configuration. It is stored in the Talk-to-Pi config directory under your user profile.

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

| Command                 | Description                        |
| ----------------------- | ---------------------------------- |
| `/talk`                 | Start voice input                  |
| `/talk --lang <locale>` | Start with a one-off language      |
| `/talk-config`          | Edit persistent settings           |
| `/talk-doctor`          | Show asset and runtime diagnostics |

## Updating

Update Talk-to-Pi through Pi:

```bash
pi update npm:talk-to-pi
```

Restart Pi or run `/reload` afterward.

## Privacy

Microphone audio is handled by the local native runtime and is not uploaded by Talk-to-Pi. Transcripts are not logged or stored separately. Once you submit text from Pi's editor, it follows Pi's configured model-provider behavior.

## Development

Clone the repository with its pinned native dependencies:

```bash
git clone --recurse-submodules https://github.com/Danmoreng/talk-to-pi.git
cd talk-to-pi
npm ci
npm run typecheck
npm test
npm run build
npm run native:build
npm run native:test
npm run local:pi
```

### Optional CUDA build

On a supported NVIDIA Linux system:

```bash
cmake -S native -B native/build-cuda -G Ninja \
  -DCMAKE_BUILD_TYPE=Release \
  -DTALK_TO_PI_ENABLE_CUDA=ON
cmake --build native/build-cuda --parallel
```

Use the resulting runtime with:

```bash
export TALK_TO_PI_RUNTIME_PATH="$PWD/native/build-cuda/talk-to-pi-runtime"
```

Architecture and protocol details are available in [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) and [`docs/PROTOCOL.md`](./docs/PROTOCOL.md).

## License

Talk-to-Pi is MIT licensed. NVIDIA NeMo-Speech.cpp, the Nemotron model, and other dependencies retain their respective licenses. See [`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md) and [`docs/LICENSING.md`](./docs/LICENSING.md).
