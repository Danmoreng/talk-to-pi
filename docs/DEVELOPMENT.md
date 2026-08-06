# Development

The project currently implements the Milestone 0/1 foundation:

- TypeScript package and Pi extension entry point;
- protocol parser/encoder and incremental JSONL decoder;
- runtime process manager with command correlation and shutdown escalation;
- read-only recording overlay;
- regular prompt-editor handoff;
- native C++ runtime skeleton with parakeet.cpp and miniaudio integration;
- native JSONL protocol test;
- generic manifest validation, verified downloads, locking, and safe runtime archive extraction.

The local development model was generated from NVIDIA's pinned Nemotron checkpoint with `native/vendor/parakeet.cpp/scripts/convert_parakeet_to_gguf.py --dtype q8_0`. The conversion environment uses Python 3.10, CPU PyTorch, the requirements in `native/vendor/parakeet.cpp/scripts/requirements.txt`, and NVIDIA NeMo commit `6c57e73e83de967eed4d334c493ac313b9afd147`. The resulting local artifact is 983696480 bytes with SHA-256 `5957dabedbef4a5eb01a1dc6204f41bb135b41aa614998d70bff7002764d39c3` and loads successfully in the native runtime. It remains a release gate until published with a stable URL and checksum.

The conversion command is:

```bash
python native/vendor/parakeet.cpp/scripts/convert_parakeet_to_gguf.py \\
  --model nvidia/nemotron-3.5-asr-streaming-0.6b \\
  --dtype q8_0 \\
  --output "$XDG_DATA_HOME/talk-to-pi/models/nemotron-3.5-asr-streaming-0.6b-q8_0-parakeet.gguf"
```
