# Talk-to-Pi JSONL protocol

Protocol version: `1`

The extension communicates with `talk-to-pi-runtime` through UTF-8 JSON Lines. Commands are written to stdin; runtime messages are read from stdout. Logs belong on stderr only.

## Rules

- One JSON object per line.
- Every message has `v: 1` and a non-empty `type`.
- Runtime messages have monotonically increasing `seq` values.
- Command messages have a unique `id`.
- A command receives exactly one direct response: `pong`, `command_ack`, or an `error` containing that `id`.
- Recording lifecycle events are asynchronous and do not repeat the command id.
- Maximum line size is 1 MiB.
- Unknown event fields are ignored; unknown command types are rejected.
- stdout never contains human-readable logs.

## Commands

```json
{"v":1,"type":"ping","id":"req-1"}
{"v":1,"type":"start","id":"req-2","sessionId":"session-1","language":"de-DE"}
{"v":1,"type":"stop","id":"req-3","sessionId":"session-1"}
{"v":1,"type":"cancel","id":"req-4","sessionId":"session-1"}
{"v":1,"type":"shutdown","id":"req-5"}
```

`start` consumes 16 kHz mono float PCM from the default microphone. `language` is an explicit locale or `auto`. Talk-to-Pi defaults to `auto`; users can set `TALK_TO_PI_LANGUAGE` or override one recording with `/talk --lang <locale>`.

## Events and responses

```json
{"v":1,"type":"hello","seq":1,"runtimeVersion":"0.1.0","protocolVersions":[1],"parakeetAbi":6,"platform":"linux-x64-cpu"}
{"v":1,"type":"loading_model","seq":2}
{"v":1,"type":"ready","seq":3,"model":"nemotron-3.5-asr-streaming-0.6b-q8_0","modelLoadMs":4321}
{"v":1,"type":"pong","id":"req-1","seq":4}
{"v":1,"type":"command_ack","id":"req-2","seq":5,"command":"start","sessionId":"session-1"}
{"v":1,"type":"recording_started","seq":6,"sessionId":"session-1","language":"de-DE","audioDevice":"Default"}
{"v":1,"type":"transcript_delta","seq":7,"sessionId":"session-1","text":"Hallo"}
{"v":1,"type":"speech_event","seq":8,"sessionId":"session-1","event":"eou","timeSec":1.2}
{"v":1,"type":"recording_finalized","seq":9,"sessionId":"session-1","text":"Hallo"}
{"v":1,"type":"recording_cancelled","seq":9,"sessionId":"session-1"}
{"v":1,"type":"shutdown_complete","seq":10}
```

A session emits exactly one terminal event: `recording_finalized`, `recording_cancelled`, or a fatal error. `transcript_delta.text` is append-only newly finalized text, never a replacement hypothesis.

Errors use this shape:

```json
{
  "v": 1,
  "type": "error",
  "seq": 11,
  "sessionId": "session-1",
  "code": "MICROPHONE_UNAVAILABLE",
  "message": "No default capture device could be opened.",
  "recoverable": true
}
```

Command rejection errors additionally contain the rejected command's `id`.
