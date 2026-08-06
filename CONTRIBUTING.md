# Contributing

Work milestone by milestone and keep changes narrow. Read [`DEVELOPMENT_PLAN.md`](./DEVELOPMENT_PLAN.md) before changing architecture.

Before opening a pull request:

```bash
npm run format:check
npm run typecheck
npm test
```

Native changes should also run:

```bash
node scripts/build-native.mjs
ctest --test-dir native/build --output-on-failure
```

Do not add npm lifecycle scripts, network listeners, transcript logging, audio-file persistence, or backend abstractions without updating the plan first.
