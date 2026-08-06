# Troubleshooting

## `/talk` says the runtime is not provisioned

For local development, start Pi with `npm run local:pi`; it supplies the locally generated parakeet.cpp model and native runtime through explicit path overrides. Run `/talk-doctor` to inspect them. Release provisioning is not enabled until the model artifact has been published with a stable URL and checksum.

## No microphone

The runtime uses the system default capture device. Check the default input device and run `/talk-doctor`. Device selection is intentionally outside the MVP.

## Runtime process remains after reload

The extension sends a protocol shutdown, then escalates to SIGTERM and SIGKILL. Capture the stderr diagnostics from `/talk-doctor` and report the Pi version, runtime version, and platform without including transcripts.
