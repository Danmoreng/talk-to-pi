# Third-party notices

Talk-to-Pi includes or links to the following pinned dependencies:

| Dependency        | Pin                                                | License       |
| ----------------- | -------------------------------------------------- | ------------- |
| `NeMo-Speech.cpp` | `2e12e2def8a98ed06666f7ee3ca94e7193e04be4`         | Apache-2.0    |
| NeMo `ggml`       | revision recorded by the NeMo-Speech.cpp submodule | MIT           |
| `miniaudio`       | `9634bedb5b5a2ca38c1ee7108a9358a4e233f14d`         | MIT-0         |
| `nlohmann/json`   | `9cca280a4d0ccf0c08f47a99aa71d1b0e52f8d03`         | MIT           |
| npm `tar`         | resolved by `package-lock.json`                    | BlueOak-1.0.0 |

The corresponding source repositories are pinned Git submodules under
`native/vendor/`. Distribution copies of the applicable licenses and NVIDIA
NOTICE are in `licenses/`. Talk-to-Pi applies a small tracked build-system patch
to embed NeMo-Speech.cpp as a CMake subdirectory; the ASR implementation is
unchanged.

The downloaded NVIDIA Nemotron model is not part of the MIT-licensed project
code. It is governed by OpenMDW-1.1 and its own attribution requirements; see
[`docs/LICENSING.md`](./docs/LICENSING.md).
