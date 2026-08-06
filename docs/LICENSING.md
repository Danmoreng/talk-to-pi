# Licensing

Talk-to-Pi source code is MIT-licensed; see [`LICENSE`](../LICENSE).

Native dependencies are retained as pinned submodules:

- `NeMo-Speech.cpp`: Apache-2.0, public NVIDIA revision `2e12e2def8a98ed06666f7ee3ca94e7193e04be4`; Talk-to-Pi applies the tracked `native/patches/nemo-speech-embed.patch` build-system patch without changing the ASR implementation;
- NeMo-Speech.cpp's bundled `ggml`: MIT, revision recorded in the submodule;
- `miniaudio`: MIT-0, `9634bedb5b5a2ca38c1ee7108a9358a4e233f14d`;
- `nlohmann/json`: MIT, `9cca280a4d0ccf0c08f47a99aa71d1b0e52f8d03`;
- npm `tar`: BlueOak-1.0.0, locked in `package-lock.json` and copied to
  `licenses/tar-BlueOak-1.0.0.md`.

The production model is NVIDIA's official Nemotron Q8_0 GGUF from repository
revision `1c8deaecc64b91f034d73e08dd8b64625eb3395d`. It has SHA-256
`a5c435f294eea8f88ce68dd27b8c3bfea7f777cb2fbba04fcd30eaa555f429ae` and is
governed by OpenMDW-1.1. The model is separate from the project code and is
downloaded from its pinned Hugging Face repository into the user's cache only
after confirmation. Talk-to-Pi is not affiliated with or endorsed by NVIDIA.
