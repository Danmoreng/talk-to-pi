# Licensing

Talk-to-Pi source code is MIT-licensed; see [`LICENSE`](../LICENSE).

Native dependencies are retained as pinned submodules:

- `parakeet.cpp`: MIT, `5fd500fad54ef86254d675c494cbb3a5eb821df4`;
- `miniaudio`: MIT-0, `9634bedb5b5a2ca38c1ee7108a9358a4e233f14d`;
- `nlohmann/json`: MIT, `9cca280a4d0ccf0c08f47a99aa71d1b0e52f8d03`;
- npm `tar`: BlueOak-1.0.0, locked in `package-lock.json` and copied to `licenses/tar-BlueOak-1.0.0.md`.

The local development model is generated from NVIDIA's Nemotron checkpoint at repository revision `1c8deaecc64b91f034d73e08dd8b64625eb3395d` using the pinned `parakeet.cpp` converter. The local generated artifact has SHA-256 `5957dabedbef4a5eb01a1dc6204f41bb135b41aa614998d70bff7002764d39c3`. The weights are governed by OpenMDW-1.1. The NVIDIA Nemotron weights are separate from the project code. Talk-to-Pi is not affiliated with or endorsed by NVIDIA.
