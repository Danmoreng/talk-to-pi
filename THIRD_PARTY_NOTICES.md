# Third-party notices

Talk-to-Pi includes or links to the following pinned dependencies:

| Dependency      | Pin                                                                       | License       |
| --------------- | ------------------------------------------------------------------------- | ------------- |
| `parakeet.cpp`  | `1764d8c6951473dbd9ba62064e876b68d5005eb0` (`v0.5.0` + CUDA teardown fix) | MIT           |
| `miniaudio`     | `9634bedb5b5a2ca38c1ee7108a9358a4e233f14d` (`0.11.25`)                    | MIT-0         |
| `nlohmann/json` | `9cca280a4d0ccf0c08f47a99aa71d1b0e52f8d03` (`v3.11.3`)                    | MIT           |
| npm `tar`       | `7.5.22` (resolved by `package-lock.json`)                                | BlueOak-1.0.0 |

The corresponding source repositories are Git submodules under `native/vendor/` and their license files are retained there. Project copies used for distribution are listed in `licenses/`, including the runtime dependency used for safe archive extraction.

The downloaded NVIDIA Nemotron model is not part of the MIT-licensed project code. It is governed by the OpenMDW-1.1 license and its own attribution requirements; see [`docs/LICENSING.md`](./docs/LICENSING.md).
