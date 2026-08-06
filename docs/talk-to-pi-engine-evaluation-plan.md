# Talk-to-Pi Engine Evaluation Plan

**Comparison:** NVIDIA NeMo-Speech.cpp vs. parakeet.cpp
**Document status:** Implementation-ready benchmark and decision plan
**Document version:** 1.0
**Research snapshot:** 2026-08-06
**Target project:** Talk-to-Pi, a Pi Coding Agent extension
**Primary target:** Linux x86_64, local CPU inference
**Model:** NVIDIA Nemotron 3.5 ASR Streaming 0.6B
**Primary production format:** Q8_0 GGUF
**Purpose:** Select one engine for the Talk-to-Pi MVP; do not ship both engines

---

## 1. Executive Summary

This plan defines a controlled, plugin-relevant comparison between:

1. **NVIDIA NeMo-Speech.cpp**, using NVIDIA's official Q8_0 GGUF from the official Nemotron 3.5 Hugging Face repository.
2. **parakeet.cpp**, using a separate Q8_0 GGUF generated with parakeet.cpp's converter from the exact same pinned NVIDIA `.nemo` checkpoint revision.

The two GGUF files are intentionally different and are not interchangeable. They use engine-specific metadata schemas, converters, and potentially different tensor-layout decisions. Therefore, the primary experiment is a **shipping-candidate comparison**, not a pure kernel microbenchmark.

The comparison must answer the actual product question:

> Which engine produces the best Talk-to-Pi experience on the target machine, considering transcript quality, perceived live latency, finalization latency, CPU and memory usage, package complexity, stability, and maintenance risk?

The evaluation uses three layers:

```text
Layer 1: Native engine benchmark
         Measures engine behavior without Pi or TUI overhead.

Layer 2: Common sidecar protocol benchmark
         Measures the runtime architecture Talk-to-Pi will ship.

Layer 3: Pi plugin A/B evaluation
         Measures the real record → live text → edit → submit workflow.
```

The final Talk-to-Pi implementation must contain only the winning engine. The temporary dual-engine interface and evaluation code should remain isolated under an experimental directory or branch and must not turn the MVP into a configurable multi-backend product.

---

## 2. Corrected Upstream Model Facts

At the research snapshot, NVIDIA's official Hugging Face repository contains:

```text
nvidia/nemotron-3.5-asr-streaming-0.6b
├── nemotron-3.5-asr-streaming-0.6b.nemo
└── nemotron-3.5-asr-streaming-0.6b.q8_0.gguf
```

The official Q8_0 file is approximately 742 MB and was added specifically for local inference with NeMo-Speech.cpp.

The official model card provides this command:

```bash
hf download nvidia/nemotron-3.5-asr-streaming-0.6b \
  nemotron-3.5-asr-streaming-0.6b.q8_0.gguf \
  --local-dir models
```

The NeMo-Speech.cpp GitHub README and some repository documentation still say that the preconverted GGUF has not yet been published. Treat that statement as stale.

Initial model-repository revision observed during research:

```text
1c8deaecc64b91f034d73e08dd8b64625eb3395d
```

The benchmark must not rely on `main` moving over time. Pin the exact Hugging Face revision used for all model downloads.

Primary references:

- https://huggingface.co/nvidia/nemotron-3.5-asr-streaming-0.6b
- https://github.com/NVIDIA/NeMo-Speech.cpp
- https://github.com/mudler/parakeet.cpp

---

## 3. Decision to Be Made

The evaluation produces one Architecture Decision Record:

```text
ADR: Select the native ASR engine for Talk-to-Pi v0.1.0
```

Allowed decisions:

```text
A. Select NeMo-Speech.cpp
B. Select parakeet.cpp
C. Defer engine selection because a blocking defect invalidated the comparison
```

Not allowed:

```text
D. Ship both engines
E. Add a permanent backend-provider abstraction
F. Let users configure arbitrary speech servers
G. Add LLM cleanup during the comparison
```

The evaluation exists to reduce uncertainty before implementing the final managed runtime. It must not expand the Talk-to-Pi MVP.

---

## 4. Comparison Principles

### 4.1 Same source checkpoint

Both production-candidate models must derive from the same pinned NVIDIA model revision.

For NeMo-Speech.cpp:

```text
Use NVIDIA's official Q8_0 GGUF from the pinned Hugging Face revision.
```

For parakeet.cpp:

```text
Download the `.nemo` checkpoint from the same pinned revision.
Generate a parakeet-compatible Q8_0 GGUF with the pinned parakeet.cpp converter.
```

This avoids accidentally comparing different model releases.

### 4.2 Same audio bytes

Every deterministic benchmark must feed the exact same decoded PCM samples to both engines.

Canonical benchmark audio:

```text
16,000 Hz
mono
float32 PCM
normalized only by a single shared preprocessing script
```

Do not let each CLI independently decode MP3, FLAC, or resample arbitrary WAV files in the primary comparison. Container decoding differences would add noise.

### 4.3 Same host conditions

For every paired benchmark:

- use the same machine;
- use the same power profile;
- use the same CPU affinity;
- use the same thread-count policy;
- alternate engine order;
- use the same audio-chunk schedule;
- collect the same process metrics;
- avoid running unrelated workloads;
- record temperature and CPU frequency where practical.

### 4.4 Compare product candidates, not file hashes

Both models may be called `Q8_0`, but they are not byte-identical representations.

Differences may include:

- GGUF metadata namespace;
- tensor names;
- tensor ordering;
- quantization allowlists;
- unquantized fallback tensors;
- prompt-kernel representation;
- mel-filterbank representation;
- backend-specific tensor layouts;
- converter implementation details.

Therefore:

> The primary Q8 experiment compares the two complete engine-and-model packages that Talk-to-Pi could ship.

Do not claim that a performance or quality difference is caused solely by the C++ inference code.

### 4.5 Add an optional precision control

If time and disk space permit, create an F16/FP16 control pair from the same `.nemo` checkpoint:

```text
NeMo-Speech.cpp FP16 GGUF
parakeet.cpp F16 GGUF
```

This secondary comparison helps identify whether a Q8 quality difference is primarily quantization-related.

The F16 control is useful but must not block the primary Q8 decision.

---

## 5. Initial Revisions to Pin

Record all final revisions in a machine-readable lock file.

Research-snapshot candidates:

```yaml
model:
  repo: nvidia/nemotron-3.5-asr-streaming-0.6b
  revision: 1c8deaecc64b91f034d73e08dd8b64625eb3395d
  nemo_file: nemotron-3.5-asr-streaming-0.6b.nemo
  nvidia_q8_file: nemotron-3.5-asr-streaming-0.6b.q8_0.gguf

nemo_speech_cpp:
  repo: NVIDIA/NeMo-Speech.cpp
  revision: 2e12e2def8a98ed06666f7ee3ca94e7193e04be4

parakeet_cpp:
  repo: mudler/parakeet.cpp
  revision: 1bfbebfaaf493866f49597cd3b7901959d395c60
```

Before starting implementation:

1. fetch the current upstream heads;
2. inspect changes since these revisions;
3. select explicit revisions;
4. document why;
5. never run the final benchmark against unpinned branches.

Create:

```text
spikes/engine-evaluation/versions.lock.yaml
```

It must also include:

- ggml submodule commits;
- compiler version;
- CMake version;
- operating-system version;
- libc version;
- CPU model;
- GPU and driver when applicable;
- Python version used for conversion;
- converter command lines;
- model file sizes;
- SHA-256 hashes.

---

## 6. Expected Model Incompatibility

The official NVIDIA Q8_0 GGUF is designed for NeMo-Speech.cpp. It uses the metadata and tensor schema expected by that runtime.

The parakeet.cpp runtime expects its own GGUF schema, including its own architecture and metadata keys. Therefore, the official NVIDIA file is expected not to load in parakeet.cpp.

Likewise, the parakeet-generated Q8_0 file should not be assumed to load in NeMo-Speech.cpp.

Add an explicit compatibility test:

| Model artifact | NeMo-Speech.cpp | parakeet.cpp |
|---|---:|---:|
| NVIDIA official Q8_0 | must load | expected rejection |
| parakeet-generated Q8_0 | expected rejection | must load |

A clean rejection is acceptable. A crash, hang, or misleading success is a defect that must be recorded.

This test prevents future developers from assuming that all Nemotron GGUF files are interchangeable.

---

## 7. Evaluation Repository Layout

Keep all comparison-only code isolated:

```text
talk-to-pi/
└── spikes/
    └── engine-evaluation/
        ├── README.md
        ├── CMakeLists.txt
        ├── versions.lock.yaml
        ├── models/
        │   ├── manifest.json
        │   └── .gitignore
        ├── native/
        │   ├── common/
        │   │   ├── evaluation_engine.hpp
        │   │   ├── evaluation_events.hpp
        │   │   ├── pcm_source.cpp
        │   │   ├── pcm_source.hpp
        │   │   ├── timing.cpp
        │   │   └── timing.hpp
        │   ├── nemo_speech/
        │   │   ├── nemo_engine.cpp
        │   │   └── nemo_engine.hpp
        │   ├── parakeet/
        │   │   ├── parakeet_engine.cpp
        │   │   └── parakeet_engine.hpp
        │   └── runner/
        │       └── main.cpp
        ├── plugin/
        │   ├── index.ts
        │   ├── evaluation-runtime.ts
        │   ├── evaluation-overlay.ts
        │   └── session-log.ts
        ├── corpus/
        │   ├── manifest.jsonl
        │   ├── references/
        │   ├── normalized/
        │   └── README.md
        ├── scripts/
        │   ├── acquire-models.py
        │   ├── convert-parakeet-model.py
        │   ├── normalize-audio.py
        │   ├── run-benchmark.py
        │   ├── collect-process-metrics.py
        │   ├── score-transcripts.py
        │   ├── analyze-streaming.py
        │   └── render-report.py
        ├── schemas/
        │   ├── event.schema.json
        │   ├── result.schema.json
        │   └── corpus.schema.json
        ├── tests/
        ├── results/
        │   └── .gitignore
        └── reports/
            └── .gitignore
```

The evaluation abstraction must not be moved into the production `src/` tree before the engine decision.

---

## 8. Temporary Common Engine Interface

Create a small evaluation-only C++ interface:

```cpp
struct EvaluationEngineConfig {
    std::string model_path;
    std::string language;
    int sample_rate = 16000;
    int threads = 0;
    int right_context_frames = -1;
};

struct EvaluationHypothesis {
    std::string text;
    bool is_final = false;
    bool is_engine_stable = false;
    double audio_processed_ms = 0.0;
    double emitted_at_ms = 0.0;
};

class EvaluationEngine {
public:
    virtual ~EvaluationEngine() = default;

    virtual std::string name() const = 0;
    virtual std::string version() const = 0;

    virtual void load(const EvaluationEngineConfig& config) = 0;
    virtual void start_stream() = 0;
    virtual void push_audio(
        const float* samples,
        std::size_t count,
        int sample_rate
    ) = 0;
    virtual std::vector<EvaluationHypothesis> poll() = 0;
    virtual std::vector<EvaluationHypothesis> finish() = 0;
    virtual void reset() = 0;
};
```

This interface exists only to ensure that the same runner, clock, PCM source, and output logger are used for both engines.

### 8.1 NeMo-Speech.cpp adapter

Use the stable C ABI:

```text
nemo_speech_asr_create
nemo_speech_asr_streaming_recognize
nemo_speech_asr_stream_push_f32
nemo_speech_asr_stream_next
nemo_speech_asr_stream_finish
nemo_speech_asr_stream_close
nemo_speech_asr_destroy
```

Set:

```text
language_code = de-DE for the primary German test
interim_results = true
rnnt_right_context = 3 for the primary 320 ms comparison
```

Each result is a complete current hypothesis. Mark:

```text
is_engine_stable = result.is_final
```

Interim results are provisional and may revise earlier text.

### 8.2 parakeet.cpp adapter

Use the flat streaming C API:

```text
parakeet_capi_load
parakeet_capi_stream_begin_lang
parakeet_capi_stream_feed_json
parakeet_capi_stream_finalize_json
parakeet_capi_stream_free
parakeet_capi_free
```

The API returns newly finalized text since the previous call.

Maintain:

```cpp
std::string cumulative_text;
```

For every non-empty delta:

```text
cumulative_text += delta
emit cumulative_text
is_engine_stable = true
```

The resulting hypothesis is cumulative for the common runner, while retaining the fact that all emitted text is stable.

### 8.3 No hidden postprocessing

Both adapters may perform only:

- documented language-tag removal;
- conversion to valid UTF-8;
- normalization of engine output into the common event shape.

They must not:

- correct punctuation;
- remove filler words;
- rewrite technical terms;
- collapse repetitions;
- run a cleanup model;
- normalize spelling;
- alter whitespace beyond documented engine-token joining.

Store both:

```text
raw engine output
normalized display output
```

This makes accidental postprocessing visible.

---

## 9. Common Event Log

Every run must produce JSON Lines with monotonic timestamps.

Example:

```json
{
  "schemaVersion": 1,
  "runId": "01J...",
  "engine": "nemo-speech-cpp",
  "event": "hypothesis",
  "emittedAtMs": 842.37,
  "audioProcessedMs": 640.0,
  "text": "Kannst du bitte die",
  "final": false,
  "engineStable": false
}
```

Parakeet example:

```json
{
  "schemaVersion": 1,
  "runId": "01J...",
  "engine": "parakeet-cpp",
  "event": "hypothesis",
  "emittedAtMs": 1183.20,
  "audioProcessedMs": 960.0,
  "text": "Kannst du bitte die Authentifizierung",
  "final": false,
  "engineStable": true
}
```

Required event types:

```text
process_started
model_load_started
model_loaded
stream_started
audio_chunk_pushed
hypothesis
speech_event
finish_requested
final_result
stream_closed
process_metrics
error
process_exited
```

Use `std::chrono::steady_clock` for in-process timing.

Do not derive latency from wall-clock timestamps.

---

## 10. Model Acquisition and Generation

## 10.1 Create a clean model workspace

```text
spikes/engine-evaluation/models/
├── source/
├── nemo-speech/
├── parakeet/
└── manifest.json
```

Large model files must remain gitignored.

## 10.2 Download the official NVIDIA files

Use the pinned revision:

```bash
hf download nvidia/nemotron-3.5-asr-streaming-0.6b \
  nemotron-3.5-asr-streaming-0.6b.q8_0.gguf \
  nemotron-3.5-asr-streaming-0.6b.nemo \
  --revision 1c8deaecc64b91f034d73e08dd8b64625eb3395d \
  --local-dir spikes/engine-evaluation/models/source
```

After downloading:

```bash
sha256sum spikes/engine-evaluation/models/source/*
stat --printf='%n %s\n' spikes/engine-evaluation/models/source/*
```

Copy or symlink the official Q8 file into:

```text
models/nemo-speech/
```

Do not rename it without preserving the original filename in the manifest.

## 10.3 Generate the parakeet Q8_0 model

Use the pinned `.nemo` file as a local input so the source revision is unambiguous.

Conceptual command:

```bash
python scripts/convert_parakeet_to_gguf.py \
  --model /absolute/path/nemotron-3.5-asr-streaming-0.6b.nemo \
  --dtype q8_0 \
  --output /absolute/path/models/parakeet/nemotron-3.5-asr-streaming-0.6b.parakeet.q8_0.gguf
```

Use the exact CLI accepted by the pinned parakeet.cpp revision. If its arguments differ, record the actual command in `models/manifest.json`.

Record:

- parakeet.cpp commit;
- converter script SHA-256;
- Python dependency lock;
- source `.nemo` SHA-256;
- output GGUF SHA-256;
- output file size;
- conversion duration;
- all converter warnings;
- count of tensors per dtype if available.

## 10.4 Optional F16 controls

Create:

```text
models/nemo-speech/nemotron-3.5.fp16.gguf
models/parakeet/nemotron-3.5.f16.gguf
```

Both must derive from the same pinned `.nemo` file.

Record the same provenance metadata.

## 10.5 Model smoke tests

Run one known German and one known English fixture through each matching engine.

Required results:

```text
official NVIDIA Q8 + NeMo-Speech.cpp: success
parakeet Q8 + parakeet.cpp: success
```

Record expected cross-loading failures.

Do not continue to full benchmarking until both matching combinations produce coherent text.

---

## 11. Build Matrix

The primary comparison targets the Talk-to-Pi MVP:

```text
Linux x86_64
CPU
single stream
portable release build
```

### 11.1 Primary portable builds

Build both projects in release mode with host-specific native optimizations disabled where each project supports that option.

The objective is to approximate redistributable Talk-to-Pi binaries.

Record:

- build commands;
- source commits;
- submodule commits;
- compile flags;
- linked libraries;
- binary sizes;
- build durations.

### 11.2 Secondary host-optimized builds

Build both engines with host-native optimizations enabled.

Purpose:

```text
Determine whether one engine benefits substantially more from local compilation.
```

Do not use the host-optimized result as the sole product decision if Talk-to-Pi plans to distribute a portable binary.

### 11.3 Optional CUDA builds

Run only when NVIDIA GPU support is a near-term Talk-to-Pi requirement.

Compare:

```text
single live stream
official Q8 block layout
same GPU
same driver
same CUDA toolkit family
default project-supported optimization path
```

NeMo-Speech.cpp includes NVIDIA-specific ggml patching and CUDA kernels. That is part of its realistic shipping candidate and should be enabled in the main CUDA comparison.

An optional stock-ggml control may be run separately, but it must not replace the production-candidate comparison.

### 11.4 Do not mix backends

Invalid comparison:

```text
NeMo-Speech.cpp on CUDA
vs.
parakeet.cpp on CPU
```

Every result row must identify:

```text
engine
model artifact
backend
thread count
build mode
host
```

---

## 12. Streaming Configuration

Nemotron 3.5 supports the following right-context operating points:

| Right-context frames | Nominal chunk/latency |
|---:|---:|
| 0 | 80 ms |
| 1 | 160 ms |
| 3 | 320 ms |
| 6 | 560 ms |
| 13 | 1120 ms |

### 12.1 Primary matched configuration

Use:

```text
language: de-DE
right context: 3
nominal streaming point: 320 ms
input push interval: 20 ms
single stream
```

Why 320 ms:

- it is a documented model operating point;
- it is the common/default preset represented by the model metadata in current parakeet conversion;
- it provides a balanced latency/accuracy point;
- NeMo-Speech.cpp can be configured to match it explicitly.

Before benchmarking, confirm and record parakeet.cpp's effective context. If it cannot be changed through its public C API, treat its model-default context as fixed and configure NeMo-Speech.cpp to the matching value.

### 12.2 Sensitivity tests

Run these additional tests:

```text
input push interval: 20, 40, 100, 160 ms
NeMo right context: 1, 3, 6
parakeet: every context exposed by the pinned public API, if any
```

Separate labels:

```text
matched configuration
engine-best low-latency configuration
engine-default configuration
```

Never compare NeMo at 160 ms with parakeet at 320 ms without labeling the mismatch.

### 12.3 Real-time and unpaced modes

Every corpus item is run in two modes.

**Real-time paced:**

```text
Feed audio according to its original duration.
Measures user-visible streaming behavior.
```

**Unpaced:**

```text
Feed audio as quickly as the engine accepts it.
Measures computational throughput.
```

Do not use unpaced TTFT as a proxy for live microphone latency.

---

## 13. Evaluation Corpus

Use two corpus stages.

## 13.1 Stage A: smoke corpus

Minimum 12 clips:

| Category | Count |
|---|---:|
| German general speech | 2 |
| German coding instructions | 4 |
| German with English technical terms | 2 |
| English coding instructions | 2 |
| Silence | 1 |
| Background noise without speech | 1 |

Purpose:

- validate harness correctness;
- identify crashes;
- validate transcript scoring;
- tune event logging.

## 13.2 Stage B: decision corpus

Recommended minimum: 80 utterances.

| Category | Count |
|---|---:|
| German coding instructions | 25 |
| German general instructions | 15 |
| German/English mixed technical speech | 15 |
| English coding instructions | 10 |
| File paths, flags, numbers, symbols spoken naturally | 5 |
| Long-form prompts, 30–90 seconds | 5 |
| Noise, silence, clipped speech, microphone stress | 5 |

For the user's private use case, at least 50% of scored speech should be recorded by the actual primary user.

For a public release decision, add recordings from at least three additional speakers.

## 13.3 Corpus manifest

Create one JSON object per recording:

```json
{
  "id": "de-code-001",
  "audio": "normalized/de-code-001.wav",
  "reference": "references/de-code-001.txt",
  "language": "de-DE",
  "category": "de_coding",
  "speaker": "primary-user",
  "durationMs": 8420,
  "speechEndMs": 7980,
  "expectedTerms": [
    "TypeScript",
    "Refresh-Token",
    "src/auth/tokenManager.ts"
  ],
  "notes": "Mixed German and English identifiers"
}
```

### 13.4 Reference transcription policy

Create references before looking at engine outputs.

Reference rules:

- preserve intended punctuation and capitalization;
- write the intended natural-language coding instruction;
- document acceptable variants;
- do not modify references to make one engine look better;
- maintain a separate normalized reference for WER;
- preserve a strict reference for edit-cost and technical-term scoring.

### 13.5 Audio normalization

Use one shared script for both engines:

```text
decode source
downmix to mono
resample to 16 kHz
convert to float32 PCM WAV
do not apply denoising
do not apply loudness normalization unless the entire corpus requires it
```

Store:

- original file hash;
- normalized file hash;
- normalization command;
- peak level;
- RMS level;
- duration.

---

## 14. Accuracy Metrics

No single metric is sufficient for a coding-input plugin.

### 14.1 Normalized WER

Calculate WER after a documented normalization:

- Unicode normalization;
- lowercase;
- punctuation removal;
- whitespace normalization;
- number normalization only when consistently applied to reference and hypothesis.

Use for general recognition accuracy.

### 14.2 Raw CER

Calculate character error rate without removing punctuation or capitalization.

Use for:

- punctuation quality;
- casing;
- German compounds;
- technical tokens;
- formatting differences.

### 14.3 Punctuation F1

Score:

```text
.
,
?
!
:
;
```

Because Talk-to-Pi has no cleanup model, punctuation directly affects edit effort.

### 14.4 Capitalization accuracy

Measure capitalization on:

- sentence starts;
- proper nouns;
- technical products;
- acronyms.

### 14.5 Technical-term accuracy

For each `expectedTerms` entry, score:

```text
exact
case-insensitive exact
minor edit
missing
hallucinated replacement
```

Report:

```text
exact technical-term recall
case-insensitive technical-term recall
```

### 14.6 Coding-prompt edit cost

Calculate character-level Levenshtein distance from engine final output to the strict intended prompt.

Report:

```text
edit_cost = edit_distance / max(reference_chars, 1)
```

This is more product-relevant than normalized WER.

### 14.7 Failure counters

Count:

- empty transcript;
- truncated final word;
- repeated phrase;
- language-tag leakage;
- false transcription during silence;
- false transcription during non-speech noise;
- wrong-language output;
- punctuation collapse;
- catastrophic hallucination.

---

## 15. Streaming UX Metrics

This section is the most important part of the comparison.

NeMo-Speech.cpp can emit changing interim hypotheses. parakeet.cpp currently emits newly finalized stable text. Comparing only "time to first text" would unfairly reward unstable text and ignore revision cost.

### 15.1 Time to first hypothesis

```text
TTFH = timestamp of first non-empty displayed hypothesis
       - timestamp of first audio sample
```

This measures initial responsiveness.

### 15.2 Time to first stable word

For each final word, determine the earliest hypothesis after which that word and every earlier word never change again.

For the first final word:

```text
TTFSW = earliest permanent appearance time
        - first audio sample time
```

For parakeet stable deltas, the emitted time is already stable.

For NeMo interim hypotheses, compute stability offline from the full event sequence.

### 15.3 Stable-prefix latency

For each final word:

```text
stable_prefix_latency(word_i)
    = time when prefix through word_i becomes permanent
      - acoustic end time of word_i
```

If word timestamps are unavailable for both engines, use the reference's manually or automatically aligned word times.

Report:

- median;
- p90;
- p95;
- maximum;
- per-category values.

This metric is the fairest measure of when the user can trust the visible text.

### 15.4 Hypothesis churn

Between consecutive cumulative hypotheses, calculate the characters removed or replaced.

```text
churn_chars = sum(deletions + replacements)
revision_ratio = churn_chars / max(final_chars, 1)
```

Also report:

- maximum suffix rewrite length;
- number of visible revisions;
- number of full-line reflows;
- longest period where visible text was later replaced.

### 15.5 Update cadence

Report:

- updates per second;
- median interval between updates;
- p95 interval;
- longest silence between non-empty updates while speech continues.

### 15.6 Stop-to-final latency

```text
stop_to_final
    = timestamp of final result
      - timestamp of finish request
```

This directly measures the pause after the user presses Enter.

### 15.7 End-of-speech-to-final latency

When `speechEndMs` is available:

```text
speech_end_to_final
    = timestamp of final result
      - annotated end of speech
```

This separates engine finalization behavior from the user's decision to stop.

### 15.8 UI render latency

At the plugin layer:

```text
ui_render_latency
    = TUI render completion timestamp
      - sidecar event receipt timestamp
```

The same TypeScript code must handle both engines.

---

## 16. Performance and Resource Metrics

### 16.1 Model load time

Measure:

```text
process start → model ready
model load call start → model ready
```

Run:

- warm filesystem cache;
- optional cold filesystem cache;
- at least five repetitions.

The plugin is expected to load the model once per Pi session, so warm runtime performance has greater decision weight than cold storage performance.

### 16.2 Streaming RTFx

For real-time streaming:

```text
streaming_compute_RTFx
    = audio duration / total measured inference compute time
```

Also record wall-clock backlog:

```text
maximum queued audio duration
final queued audio duration
dropped samples
```

An engine can be computationally faster than real time while still producing inconveniently delayed text, so RTFx must not replace UX metrics.

### 16.3 Unpaced throughput

Measure:

```text
audio seconds processed / wall-clock second
```

Exclude model load.

Use repeated paired runs.

### 16.4 CPU usage

Collect:

- average process CPU percent;
- peak process CPU percent;
- user CPU time;
- system CPU time;
- context switches;
- thread count;
- CPU affinity;
- frequency samples if available.

### 16.5 Memory

Collect:

- peak RSS;
- steady-state RSS after model load;
- RSS after five completed streams;
- RSS after 100 completed streams;
- virtual-memory size;
- GPU memory when applicable.

### 16.6 Artifact and distribution size

Record:

- GGUF size;
- runtime executable size;
- compressed release archive size;
- required shared-library size;
- total first-use download size;
- installed disk size;
- license/notice files required.

### 16.7 Build complexity

Record:

- build duration;
- toolchain prerequisites;
- number of native dependencies;
- patches applied to ggml;
- platform-specific build steps;
- dynamic-library requirements;
- number of release variants needed.

---

## 17. Stability and Failure Tests

Run both engines through the same tests.

### 17.1 Sequential-session soak

```text
100 recording sessions
same loaded model
vary clip lengths
reset stream after every session
```

Pass criteria:

- no crash;
- no hang;
- no growing transcript state;
- no significant monotonic RSS growth;
- all final events delivered;
- all streams cleanly released.

### 17.2 Cancel soak

```text
50 sessions cancelled at random times
```

Pass criteria:

- microphone/audio feeder stops;
- stream closes;
- next stream starts successfully;
- no stale result enters the next session.

### 17.3 Empty and silence input

Test:

- zero samples;
- 500 ms silence;
- 5 seconds silence;
- 30 seconds silence;
- low background noise.

Record false-positive text.

### 17.4 Abrupt process shutdown

Terminate during:

- model load;
- active stream;
- finalization.

Evaluate how easily the Talk-to-Pi extension can:

- detect failure;
- preserve already displayed text;
- terminate the process;
- restart on the next session.

### 17.5 Malformed model

Test:

- missing model;
- wrong engine's GGUF;
- truncated GGUF;
- invalid path;
- permission denied.

The engine must return a useful error rather than crashing.

### 17.6 Audio pressure

Feed audio:

- slower than real time;
- exactly real time;
- temporary 2× bursts;
- fully unpaced.

Record queue growth and failure behavior.

---

## 18. Native Benchmark Runs

Use paired, alternating execution order.

Example order:

```text
A B B A
B A A B
```

Where:

```text
A = NeMo-Speech.cpp
B = parakeet.cpp
```

This reduces thermal and cache-order bias.

### 18.1 Primary run matrix

```text
backend: CPU
build: portable release
model: engine-specific Q8_0
language: de-DE
right context: matched 320 ms
push size: 20 ms
pace: real time
threads: 1, 2, 4, 8, auto
corpus: decision corpus
repeats: 5 for performance clips, 1 for full quality corpus
```

### 18.2 Throughput matrix

```text
pace: unpaced
threads: 1, 2, 4, 8, auto
clip lengths: short, medium, long
repeats: 7 after one warmup
```

### 18.3 Streaming sensitivity matrix

```text
push size: 20, 40, 100, 160 ms
right context: matched 320 ms
subset: 12 representative clips
repeats: 5
```

### 18.4 NeMo low-latency exploration

Additional, separately labeled:

```text
right context: 1 / 160 ms
right context: 0 / 80 ms
```

Compare quality degradation and stable-prefix latency.

Do not merge these values into the matched 320 ms table.

### 18.5 F16 control matrix

Optional:

```text
backend: CPU
build: portable release
model: engine-specific F16
language: de-DE
right context: 320 ms
push size: 20 ms
subset: 30 clips
```

Purpose:

- investigate whether Q8 conversion explains quality differences;
- compare engine output against a higher-precision control.

---

## 19. Sidecar Protocol Comparison

The production Talk-to-Pi design uses one managed child process.

Build two temporary sidecar variants:

```text
talk-to-pi-eval-nemo
talk-to-pi-eval-parakeet
```

They must implement the same JSONL protocol:

```json
{"v":1,"type":"start","sessionId":"...","language":"de-DE"}
{"v":1,"type":"audio","sessionId":"...","pcmFile":"...","pace":"realtime"}
{"v":1,"type":"stop","sessionId":"..."}
```

Runtime events:

```json
{
  "v": 1,
  "type": "hypothesis",
  "sessionId": "...",
  "text": "...",
  "final": false,
  "engineStable": false,
  "audioProcessedMs": 640
}
```

Final:

```json
{
  "v": 1,
  "type": "final",
  "sessionId": "...",
  "text": "...",
  "audioDurationMs": 8420,
  "finishLatencyMs": 126
}
```

The benchmark sidecar may accept file-driven PCM for deterministic tests. The final production sidecar can later own microphone capture.

Measure:

- process startup;
- model readiness;
- JSONL parse overhead;
- event throughput;
- final-event delivery;
- shutdown reliability;
- stderr-log volume;
- protocol implementation complexity.

---

## 20. Pi Plugin A/B Evaluation

Native metrics do not fully capture the user experience. Build a temporary evaluation extension.

### 20.1 Command

```text
/talk-eval
```

Development-only options:

```text
/talk-eval --engine nemo
/talk-eval --engine parakeet
/talk-eval --engine random
/talk-eval --reveal-engine
```

The public Talk-to-Pi command remains `/talk`; do not ship `/talk-eval`.

### 20.2 UI behavior

Use the same overlay for both engines.

Recording mode:

- show the current cumulative hypothesis;
- do not expose engine name in blinded mode;
- update on every engine event;
- disable editing;
- Enter stops;
- Escape discards.

Editing mode:

- populate the same Pi TUI `Editor`;
- allow corrections;
- Enter submits to a local evaluation result, not necessarily to the agent;
- record correction metrics;
- do not run cleanup.

### 20.3 Blinded randomized sessions

For a personal evaluation:

```text
20 sessions per engine
40 total
randomized order
same task categories
engine hidden until the end
```

Record:

- session duration;
- time to first visible text;
- time to final text;
- correction start time;
- correction completion time;
- number of inserted characters;
- number of deleted characters;
- cursor movements if practical;
- final accepted text;
- user rating from 1 to 5:
  - responsiveness;
  - visual stability;
  - transcript usefulness;
  - overall preference.

Do not record audio unless the evaluator explicitly enables local recording for analysis.

### 20.4 Correction metrics

Calculate:

```text
manual_edit_distance =
  distance(engine_final_text, user_accepted_text)

manual_edit_ratio =
  manual_edit_distance / max(user_accepted_chars, 1)

time_to_submit =
  final_result_time → explicit submit time
```

These are high-value product metrics because Talk-to-Pi intentionally omits LLM cleanup.

### 20.5 Reveal and preference

After the complete randomized trial, reveal engine assignments and show:

- average correction ratio;
- median time to submit;
- average rating;
- crashes/errors;
- resource summary.

Do not reveal after each session; that would bias later ratings.

---

## 21. Statistical Analysis

Because every audio clip is tested with both engines, use paired analysis.

### 21.1 Report distributions

For latency and performance:

- median;
- p90;
- p95;
- interquartile range;
- minimum and maximum;
- bootstrap 95% confidence interval.

Avoid reporting only averages.

### 21.2 Accuracy differences

Calculate per-utterance differences:

```text
WER_nemo - WER_parakeet
CER_nemo - CER_parakeet
edit_cost_nemo - edit_cost_parakeet
```

Use paired bootstrap confidence intervals.

A corpus-wide WER difference without per-utterance pairing can hide category-specific failures.

### 21.3 Category breakdowns

Always report separately:

- German coding;
- German general;
- mixed German/English;
- English coding;
- long-form;
- noise/silence.

The overall score must not hide poor mixed-language coding performance.

### 21.4 Outlier review

Generate an HTML or Markdown error browser showing:

```text
audio id
reference
NeMo final
parakeet final
raw event timeline
WER/CER/edit cost
expected technical terms
```

Manually inspect the worst 10 clips for each engine.

---

## 22. Decision Gates

An engine must pass all mandatory gates.

### 22.1 Mandatory functional gates

- Loads its production Q8 model reliably.
- Supports `de-DE`.
- Produces real streaming output.
- Finalizes after explicit stop.
- Runs fully offline after model installation.
- Completes 100 sequential streams without crash or hang.
- Does not leak transcript state between sessions.
- Does not create audio files.
- Can be cleanly wrapped in a managed child process.
- Has licensing compatible with distributing a Talk-to-Pi runtime.

### 22.2 Mandatory performance gates

On the primary target machine:

```text
No sustained audio backlog during real-time speech.
Streaming compute RTFx > 1.25 under the chosen thread policy.
p95 stop-to-final latency < 1,000 ms.
p95 UI event-to-render latency < 100 ms.
Peak RSS fits the target system with Pi and the coding model client running.
```

Adjust the RSS limit to the actual target hardware before execution.

### 22.3 Mandatory quality gates

On the personal weighted corpus:

```text
No catastrophic hallucination in normal speech.
Silence false-positive rate acceptable for explicit push-to-talk.
Technical-term accuracy sufficient for manual editing.
No systematic final-word truncation.
No language-tag leakage in explicit de-DE mode.
```

### 22.4 Packaging gates

- A reproducible Linux x86_64 CPU runtime can be built.
- Required notices can be bundled.
- Runtime archive can be downloaded and checksum-verified.
- No system service is required.
- No Python runtime is required during inference.
- No network listener is required.

---

## 23. Weighted Decision Score

After mandatory gates pass, calculate a score.

Recommended weights for Talk-to-Pi:

| Area | Weight |
|---|---:|
| Final transcript quality and edit cost | 30% |
| Live UX and stable-prefix latency | 30% |
| CPU, memory, and finalization performance | 20% |
| Packaging and implementation simplicity | 10% |
| Upstream maintenance and strategic confidence | 10% |

### 23.1 Transcript quality score

Components:

```text
normalized WER
raw CER
technical-term exact recall
punctuation F1
manual edit ratio
```

### 23.2 Live UX score

Components:

```text
TTFH
TTFSW
p95 stable-prefix latency
hypothesis churn
update cadence
stop-to-final latency
blinded user rating
```

### 23.3 Resource score

Components:

```text
streaming RTFx
average CPU
peak RSS
model load time
runtime/model download size
```

### 23.4 Simplicity score

Components:

```text
engine-specific adapter LOC
native dependency count
build steps
release variants
protocol complexity
failure handling
license/notice complexity
```

### 23.5 Strategic score

Components:

```text
public stable ABI
upstream activity
official model support
release artifact maturity
test coverage
documentation quality
risk of model-schema drift
```

---

## 24. Selection Rules

Use the following rules rather than choosing on reputation alone.

### Select NeMo-Speech.cpp when:

- it has materially lower stable-prefix latency or edit cost;
- its changing interim hypotheses make the plugin feel substantially more responsive;
- final accuracy is not meaningfully worse;
- CPU and memory remain acceptable;
- the additional build and distribution complexity is manageable;
- the official NVIDIA model artifact reduces provisioning risk.

A useful materiality threshold:

```text
at least 15–20% improvement in a primary UX metric
or
at least 10% reduction in manual edit ratio
```

### Select parakeet.cpp when:

- final quality is equal or better;
- stable-prefix latency is competitive;
- NeMo's earlier partials mostly produce visual churn rather than useful text;
- parakeet uses less memory or CPU;
- its runtime is materially easier to package;
- no NeMo advantage exceeds normal benchmark variance.

### Default tie-breaker

When the engines are practically equivalent:

> Select the simpler, smaller, better-proven runtime for the MVP.

Do not select NeMo-Speech.cpp solely because it is official NVIDIA software.
Do not select parakeet.cpp solely because it was evaluated first.

---

## 25. Deliverables

The coding agent must produce:

```text
spikes/engine-evaluation/README.md
spikes/engine-evaluation/versions.lock.yaml
spikes/engine-evaluation/models/manifest.json
spikes/engine-evaluation/corpus/manifest.jsonl
spikes/engine-evaluation/native runner and adapters
spikes/engine-evaluation/plugin evaluation extension
spikes/engine-evaluation/scripts
spikes/engine-evaluation/tests
spikes/engine-evaluation/reports/summary.md
spikes/engine-evaluation/reports/summary.json
docs/adr/XXXX-talk-to-pi-asr-engine.md
```

The final report must contain:

- exact versions and hashes;
- build commands;
- hardware description;
- corpus description;
- accuracy tables;
- streaming-latency tables;
- resource tables;
- packaging comparison;
- failure-test results;
- blinded user-study results;
- selected engine;
- rejected engine;
- decision rationale;
- known limitations.

---

## 26. Implementation Milestones

## Milestone 0 — Freeze Inputs

Tasks:

1. Pin the Hugging Face revision.
2. Pin both engine revisions.
3. Download the official NVIDIA Q8 and `.nemo` files.
4. Calculate hashes and sizes.
5. Generate the parakeet Q8.
6. Record converter environment.
7. Verify model licenses.
8. Create `versions.lock.yaml`.
9. Verify expected cross-engine incompatibility.

Exit criteria:

- both matching engine/model pairs transcribe one German fixture;
- all hashes are recorded;
- no benchmark uses an unpinned artifact.

---

## Milestone 1 — Build the Common Native Runner

Tasks:

1. Implement the evaluation-only engine interface.
2. Implement common PCM loading.
3. Implement real-time pacing.
4. Implement unpaced feeding.
5. Implement monotonic event timing.
6. Implement JSONL output.
7. Implement NeMo adapter.
8. Implement parakeet adapter.
9. Add smoke tests with fake engines.
10. Validate final transcript reconciliation.

Exit criteria:

- the same runner drives both engines;
- event logs pass schema validation;
- no engine-specific audio feeder exists.

---

## Milestone 2 — Corpus and Scoring

Tasks:

1. Create Stage A corpus.
2. Normalize all audio.
3. Create references before inspecting results.
4. Implement WER and CER.
5. Implement punctuation and capitalization scoring.
6. Implement technical-term scoring.
7. Implement edit-cost scoring.
8. Implement stable-prefix analysis.
9. Implement hypothesis churn analysis.
10. Generate a per-utterance error browser.

Exit criteria:

- a single command scores both engines;
- metrics are reproducible;
- manual inspection confirms the stability calculations.

---

## Milestone 3 — Automated Native Benchmarks

Tasks:

1. Implement alternating run order.
2. Collect process metrics.
3. Run thread-count matrix.
4. Run real-time matrix.
5. Run unpaced matrix.
6. Run chunk-size sensitivity.
7. Run 320 ms matched comparison.
8. Run optional NeMo low-latency modes.
9. Run optional F16 controls.
10. Generate initial report.

Exit criteria:

- complete paired result set;
- no unexplained missing runs;
- every result references exact artifact hashes.

---

## Milestone 4 — Stability and Failure Evaluation

Tasks:

1. Run 100-session soak.
2. Run cancel soak.
3. Test silence and noise.
4. Test malformed models.
5. Test abrupt shutdown.
6. Test audio-pressure conditions.
7. Measure RSS across repeated sessions.
8. Document all crashes and hangs.
9. File upstream issues for reproducible engine defects when appropriate.

Exit criteria:

- both engines have a complete reliability profile;
- any disqualifying defect is documented with a minimal reproducer.

---

## Milestone 5 — Pi Plugin A/B Spike

Tasks:

1. Build the temporary `/talk-eval` extension.
2. Implement one common overlay.
3. Support both evaluation sidecars.
4. Hide engine identity in randomized mode.
5. Record correction metrics locally.
6. Run 20 blinded sessions per engine.
7. Export local session metrics.
8. Reveal assignments only after completion.
9. Add usability results to the report.

Exit criteria:

- the user can compare actual live behavior;
- no session is auto-submitted;
- the same editor and keyboard behavior are used for both engines.

---

## Milestone 6 — Decision and Cleanup

Tasks:

1. Calculate mandatory gates.
2. Calculate weighted score.
3. Review worst transcripts.
4. Review benchmark confidence intervals.
5. Write ADR.
6. Select one engine.
7. Update the main Talk-to-Pi development plan.
8. Remove or archive the losing production adapter.
9. Keep reproducible comparison scripts under `spikes/`.
10. Open implementation issues for the selected engine only.

Exit criteria:

- one engine is selected;
- the decision is evidence-based;
- the production MVP scope remains single-engine.

---

## 27. Suggested Commands

These commands are examples. The coding agent must verify them against the pinned revisions.

### Download official NVIDIA artifacts

```bash
hf download nvidia/nemotron-3.5-asr-streaming-0.6b \
  nemotron-3.5-asr-streaming-0.6b.nemo \
  nemotron-3.5-asr-streaming-0.6b.q8_0.gguf \
  --revision 1c8deaecc64b91f034d73e08dd8b64625eb3395d \
  --local-dir spikes/engine-evaluation/models/source
```

### Build NeMo-Speech.cpp CPU ASR

```bash
git clone https://github.com/NVIDIA/NeMo-Speech.cpp.git third_party/NeMo-Speech.cpp
cd third_party/NeMo-Speech.cpp
git checkout 2e12e2def8a98ed06666f7ee3ca94e7193e04be4
git submodule update --init ggml
scripts/configure.sh cpu-asr
cmake --build --preset cpu-asr
```

### Build parakeet.cpp CPU

```bash
git clone --recursive https://github.com/mudler/parakeet.cpp.git third_party/parakeet.cpp
cd third_party/parakeet.cpp
git checkout 1bfbebfaaf493866f49597cd3b7901959d395c60
git submodule update --init --recursive
cmake -B build \
  -DCMAKE_BUILD_TYPE=Release \
  -DGGML_NATIVE=OFF \
  -DPARAKEET_BUILD_TESTS=ON \
  -DPARAKEET_SHARED=ON
cmake --build build -j
```

### Convert parakeet Q8

```bash
python third_party/parakeet.cpp/scripts/convert_parakeet_to_gguf.py \
  --model "$PWD/spikes/engine-evaluation/models/source/nemotron-3.5-asr-streaming-0.6b.nemo" \
  --dtype q8_0 \
  --output "$PWD/spikes/engine-evaluation/models/parakeet/nemotron-3.5-asr-streaming-0.6b.parakeet.q8_0.gguf"
```

### Run one paired benchmark

```bash
python spikes/engine-evaluation/scripts/run-benchmark.py \
  --engine both \
  --corpus spikes/engine-evaluation/corpus/manifest.jsonl \
  --language de-DE \
  --right-context 3 \
  --push-ms 20 \
  --pace realtime \
  --threads 4 \
  --repeat 5
```

### Render the decision report

```bash
python spikes/engine-evaluation/scripts/render-report.py \
  --results spikes/engine-evaluation/results \
  --output spikes/engine-evaluation/reports/summary.md
```

---

## 28. Result Schema

Each completed run should produce:

```json
{
  "schemaVersion": 1,
  "runId": "01J...",
  "engine": {
    "name": "nemo-speech-cpp",
    "revision": "2e12e2d...",
    "build": "portable-cpu-release"
  },
  "model": {
    "sourceRevision": "1c8deae...",
    "path": "...q8_0.gguf",
    "sha256": "...",
    "sizeBytes": 0,
    "format": "q8_0",
    "converter": "official-nvidia"
  },
  "host": {
    "os": "...",
    "kernel": "...",
    "cpu": "...",
    "physicalCores": 0,
    "logicalCores": 0,
    "ramBytes": 0
  },
  "configuration": {
    "language": "de-DE",
    "rightContextFrames": 3,
    "pushMs": 20,
    "pace": "realtime",
    "threads": 4
  },
  "audio": {
    "id": "de-code-001",
    "sha256": "...",
    "durationMs": 8420
  },
  "metrics": {
    "modelLoadMs": 0,
    "ttfhMs": 0,
    "ttfswMs": 0,
    "stopToFinalMs": 0,
    "streamingRtfx": 0,
    "peakRssBytes": 0,
    "averageCpuPercent": 0,
    "wer": 0,
    "cer": 0,
    "editCost": 0,
    "revisionRatio": 0
  },
  "status": "success"
}
```

Never leave configuration fields implicit.

---

## 29. Report Table Templates

### 29.1 Shipping-candidate summary

| Metric | NeMo-Speech.cpp official Q8 | parakeet.cpp generated Q8 | Winner |
|---|---:|---:|---|
| Model size | | | |
| Runtime archive size | | | |
| Model load p50 | | | |
| Peak RSS | | | |
| Streaming RTFx | | | |
| TTFH p50 | | | |
| First stable word p50 | | | |
| Stable-prefix latency p95 | | | |
| Stop-to-final p95 | | | |
| Revision ratio | | | |
| Normalized WER | | | |
| Raw CER | | | |
| Technical-term exact recall | | | |
| Manual edit ratio | | | |
| 100-session failures | | | |
| Build complexity score | | | |
| Blinded preference | | | |

### 29.2 Per-category quality

| Category | Clips | NeMo WER | parakeet WER | NeMo edit cost | parakeet edit cost |
|---|---:|---:|---:|---:|---:|
| German coding | | | | | |
| German general | | | | | |
| Mixed technical | | | | | |
| English coding | | | | | |
| Long-form | | | | | |
| Noise/silence | | | | | |

### 29.3 Live behavior

| Engine | TTFH p50 | TTFSW p50 | Stable prefix p95 | Churn | Stop-to-final p95 |
|---|---:|---:|---:|---:|---:|
| NeMo-Speech.cpp | | | | | |
| parakeet.cpp | | | | | |

---

## 30. Definition of Done

The engine comparison is complete only when:

### Inputs

- [ ] Both engine revisions are pinned.
- [ ] The Hugging Face revision is pinned.
- [ ] The official NVIDIA Q8 hash is recorded.
- [ ] The source `.nemo` hash is recorded.
- [ ] The parakeet Q8 is reproducibly generated.
- [ ] Model and code licenses are documented.

### Harness

- [ ] One common runner feeds identical PCM.
- [ ] Both adapters emit the same event schema.
- [ ] Timing uses a monotonic clock.
- [ ] Real-time and unpaced modes exist.
- [ ] Raw and normalized output are both preserved.
- [ ] No cleanup or hidden rewriting exists.

### Quality

- [ ] Stage B corpus contains at least 80 utterances.
- [ ] At least half of scored speech represents the primary user.
- [ ] References were authored before engine output review.
- [ ] WER, CER, edit cost, punctuation, and technical-term metrics are complete.
- [ ] Worst-case transcripts were manually reviewed.

### Streaming UX

- [ ] TTFH is measured.
- [ ] First stable word is measured.
- [ ] Stable-prefix latency is measured.
- [ ] Hypothesis churn is measured.
- [ ] Stop-to-final latency is measured.
- [ ] Plugin-level render latency is measured.
- [ ] Blinded A/B sessions are complete.

### Performance

- [ ] CPU thread matrix is complete.
- [ ] Peak RSS is measured.
- [ ] Model-load time is measured.
- [ ] Streaming RTFx is measured.
- [ ] Audio backlog and dropped frames are measured.
- [ ] Artifact sizes and build complexity are documented.

### Reliability

- [ ] 100-session soak passes or failures are documented.
- [ ] Cancel soak is complete.
- [ ] Silence and noise tests are complete.
- [ ] Wrong-model tests are complete.
- [ ] Shutdown and crash behavior are complete.

### Decision

- [ ] Mandatory gates are evaluated.
- [ ] Weighted score is calculated.
- [ ] ADR selects exactly one engine.
- [ ] The main Talk-to-Pi plan is updated.
- [ ] Production implementation issues reference only the selected engine.

---

## 31. Coding-Agent Execution Instructions

A coding agent implementing this plan must:

1. Work only under `spikes/engine-evaluation/` until the ADR is accepted.
2. Keep the comparison reproducible.
3. Never benchmark moving branches.
4. Never substitute a different model revision for one engine.
5. Never call the two Q8 files identical.
6. Never hide converter warnings.
7. Never perform transcript cleanup.
8. Never use CLI text scraping when a stable C API exists.
9. Keep audio feeding identical.
10. Keep event timing in the common runner.
11. Treat NeMo interim output as provisional.
12. Treat parakeet deltas as stable append-only text.
13. Calculate stable-prefix metrics offline from complete event histories.
14. Alternate benchmark order.
15. Record failed runs rather than silently retrying until success.
16. Preserve raw output.
17. Add tests with every metric implementation.
18. Keep personal audio and results out of Git.
19. Do not create a permanent multi-engine production layer.
20. Finish with a written ADR, not an informal preference.

---

## 32. Recommended Final Decision Heuristic

The most important question is not which engine emits text first. It is:

> Which engine lets the user reach a correct, editable, ready-to-submit coding prompt sooner and with less correction?

Prioritize these metrics in order:

1. manual edit ratio;
2. stable-prefix latency;
3. stop-to-final latency;
4. transcript quality on mixed German/English coding speech;
5. stability over repeated sessions;
6. CPU and memory on the actual target machine;
7. packaging effort.

A likely interpretation pattern:

```text
NeMo emits text much earlier,
but rewrites it heavily,
and final edit cost is equal:
    early partials are mostly cosmetic.

NeMo emits text earlier,
stable words also arrive earlier,
and edit cost is equal or lower:
    NeMo provides a real plugin UX advantage.

parakeet emits text later,
but stable-prefix latency is close,
uses fewer resources,
and is simpler to ship:
    parakeet is the better MVP choice.

One engine has clearly lower correction effort:
    prefer it unless it fails a mandatory operational gate.
```

---

## 33. Primary References

- NVIDIA Nemotron 3.5 ASR Streaming model repository
  https://huggingface.co/nvidia/nemotron-3.5-asr-streaming-0.6b

- NVIDIA NeMo-Speech.cpp
  https://github.com/NVIDIA/NeMo-Speech.cpp

- NeMo-Speech.cpp native SDK documentation
  https://github.com/NVIDIA/NeMo-Speech.cpp/blob/main/docs/sdk.md

- NeMo-Speech.cpp ASR C API
  https://github.com/NVIDIA/NeMo-Speech.cpp/blob/main/include/nemo_speech/asr.h

- NeMo-Speech.cpp live microphone example
  https://github.com/NVIDIA/NeMo-Speech.cpp/blob/main/examples/transcribe_live.cpp

- parakeet.cpp
  https://github.com/mudler/parakeet.cpp

- parakeet.cpp C API
  https://github.com/mudler/parakeet.cpp/blob/master/include/parakeet_capi.h

- parakeet.cpp benchmark documentation
  https://github.com/mudler/parakeet.cpp/blob/master/benchmarks/BENCHMARK.md

---

## 34. Final Recommendation for the Comparison

Do not decide from upstream benchmark claims alone.

Build the smallest possible dual-engine evaluation spike, feed both engines the same pinned audio, and focus on:

```text
stable useful text
final correction effort
stop-to-final latency
resource cost
managed-runtime complexity
```

Use NVIDIA's official Q8_0 GGUF for the NeMo-Speech.cpp shipping candidate. Generate a separate parakeet-compatible Q8_0 GGUF from the exact same pinned `.nemo` checkpoint for the parakeet shipping candidate.

After the ADR, remove the losing engine from the production implementation and continue with a single managed Talk-to-Pi runtime.
