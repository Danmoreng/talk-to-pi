# Releasing

Talk-to-Pi ships a platform-neutral npm package and immutable native runtime
archives. The model is not republished; every platform uses the pinned NVIDIA
GGUF from the model manifest.

## Supported native targets

- `linux-x64-cpu` (AVX2, FMA, F16C, BMI2)
- `linux-arm64-cpu`
- `darwin-x64-cpu` (AVX2, FMA, F16C, BMI2)
- `darwin-arm64-cpu`
- `win32-x64-cpu` (AVX2)

## Runtime release

1. Set `package.json`, `RUNTIME_VERSION`, and the runtime manifest version to
   the same semantic version.
2. Run all local checks and push `main`.
3. Dispatch **Native runtime release** with that version, or push the matching
   `runtime-vVERSION` tag.
4. The workflow builds each target natively, installs its shared libraries,
   smoke-tests the packaged runtime, and publishes verified `.tar.gz` assets.
5. Download `runtime-v1.json` from the GitHub runtime release, replace
   `manifests/runtime-v1.json`, and commit it.
6. Run `node scripts/verify-publish.mjs` and the normal test suite.

Runtime URLs are immutable GitHub release URLs. Archives and downloads are
verified by exact byte count and SHA-256. Runtime archives may contain only the
executable plus regular files under `lib/` and `licenses/`; links and path
traversal entries are rejected.

## npm release

The npm package must never be published while its runtime manifest is empty or
incomplete. The **npm release** workflow checks all five native targets before
publishing.

Configure npm Trusted Publishing before creating the final package tag:

- provider: GitHub Actions
- repository owner: `Danmoreng`
- repository: `talk-to-pi`
- workflow: `npm-release.yml`
- environment: leave empty

The workflow authenticates with GitHub OIDC and publishes with npm provenance;
no npm token is stored in GitHub.

To release, push the package commit and create the matching `vVERSION` tag. The
workflow publishes npm and creates the corresponding GitHub source release. Do
not reuse or move release tags.
