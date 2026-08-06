# Talk-to-Pi engine evaluation spike

This directory compares the two shipping candidates from
`docs/talk-to-pi-engine-evaluation-plan.md` without changing the production
runtime:

- NVIDIA NeMo-Speech.cpp at `2e12e2def8a98ed06666f7ee3ca94e7193e04be4`;
- parakeet.cpp at the locally patched revision
  `1764d8c6951473dbd9ba62064e876b68d5005eb0`.

Large model files, normalized audio, results, and reports are intentionally
ignored. The current checkout uses symlinks to the already verified local
artifacts under `models/`.

## Build

NeMo-Speech.cpp:

```bash
cd spikes/engine-evaluation/third_party/NeMo-Speech.cpp
scripts/configure.sh cpu-asr
cmake --build --preset cpu-asr -j$(nproc)
cd ../../../..
```

Common CPU runner:

```bash
cmake -S spikes/engine-evaluation \
  -B spikes/engine-evaluation/build \
  -G Ninja -DCMAKE_BUILD_TYPE=Release
cmake --build spikes/engine-evaluation/build -j$(nproc)
ctest --test-dir spikes/engine-evaluation/build --output-on-failure
```

Optional NVIDIA CUDA build:

```bash
cmake -S spikes/engine-evaluation \
  -B spikes/engine-evaluation/build-cuda \
  -G Ninja -DCMAKE_BUILD_TYPE=Release \
  -DTALK_TO_PI_ENABLE_CUDA=ON
cmake --build spikes/engine-evaluation/build-cuda -j$(nproc)
```

Use `talk-to-pi-parakeet-eval` for the CUDA run. The combined runner keeps
NeMo's CPU `libggml` loaded and must not be used for a parakeet CUDA process.

## Model and compatibility checks

```bash
python3 spikes/engine-evaluation/scripts/validate-models.py
```

The runner deliberately rejects the other engine's model format. Matching
smoke runs use identical 16 kHz mono PCM:

```bash
python3 spikes/engine-evaluation/scripts/run-benchmark.py \
  --engine both --pace unpaced --threads 4 --repeat 1
python3 spikes/engine-evaluation/scripts/run-benchmark.py \
  --engine parakeet \
  --eval-binary spikes/engine-evaluation/build-cuda/talk-to-pi-parakeet-eval \
  --pace unpaced --threads 4 --repeat 1
python3 spikes/engine-evaluation/scripts/render-report.py \
  --results spikes/engine-evaluation/results \
  --output spikes/engine-evaluation/reports/smoke-summary.md
```

The current smoke corpus is the existing public LibriSpeech fixture from
parakeet.cpp. It is harness validation only, not the German product decision
corpus. The decision corpus requires references and recordings from the actual
primary user. For RTF, use an unpaced run: wall time after stream start divided
by audio duration; values below one are faster than real time. Model-load time
is reported separately because production loads the model before recording.

On the local RTX 5080, the experimental CUDA parakeet runner measured RTF
`0.049`, TTFH `~92 ms`, and stop-to-final `~9 ms` after initialization. The
first process paid approximately `2.9 s` for CUDA/model initialization. This is
an exploratory result, not yet a production default.

## Conversion provenance

The parakeet artifact was generated from the pinned NVIDIA `.nemo` checkpoint
with:

```bash
python native/vendor/parakeet.cpp/scripts/convert_parakeet_to_gguf.py \
  --model nvidia/nemotron-3.5-asr-streaming-0.6b \
  --dtype q8_0 \
  --output nemotron-3.5-asr-streaming-0.6b.parakeet.q8_0.gguf
```

The complete hashes, toolchain, source revisions, and local artifact sizes are
in `versions.lock.yaml` and `models/manifest.json`.

## Implemented versus pending

Implemented:

- pinned source/model metadata;
- CPU builds for both engines;
- common 16 kHz mono WAV loader with deterministic resampling;
- common JSONL event runner;
- real-time and unpaced feeding;
- NeMo interim/final hypothesis adapter;
- parakeet stable cumulative-delta adapter;
- explicit cross-engine incompatibility checks;
- basic WER/CER/edit-cost, hypothesis-churn, TTFH, and stop-to-final metrics;
- process CPU/RSS collection;
- smoke report generation.

Pending until suitable audio is available:

- 80-utterance German decision corpus;
- personal blinded A/B sessions;
- full 100-session and cancel soaks;
- F16 controls;
- final weighted score and ADR.
