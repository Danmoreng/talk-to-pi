# Licensing

Talk-to-Pi source code is MIT-licensed; see [`LICENSE`](../LICENSE).

Native dependencies are retained as pinned submodules:

- `parakeet.cpp`: MIT, `1bfbebfaaf493866f49597cd3b7901959d395c60`;
- `miniaudio`: MIT-0, `9634bedb5b5a2ca38c1ee7108a9358a4e233f14d`;
- `nlohmann/json`: MIT, `9cca280a4d0ccf0c08f47a99aa71d1b0e52f8d03`;
- npm `tar`: BlueOak-1.0.0, locked in `package-lock.json` and copied to `licenses/tar-BlueOak-1.0.0.md`.

The NVIDIA Nemotron weights are separate from the project code and are governed by OpenMDW-1.1. The exact model artifact, source revision, derivative GGUF provenance, license text, and checksum must be finalized before release. Talk-to-Pi is not affiliated with or endorsed by NVIDIA.
