# Troubleshooting

## `/talk` says the runtime is not provisioned

This is expected during development. Run `/talk-doctor` to inspect the managed runtime and model paths. Release provisioning is not enabled until the model artifact has passed the compatibility and licensing gate.

## No microphone

The runtime uses the system default capture device. Check the default input device and run `/talk-doctor`. Device selection is intentionally outside the MVP.

## Runtime process remains after reload

The extension sends a protocol shutdown, then escalates to SIGTERM and SIGKILL. Capture the stderr diagnostics from `/talk-doctor` and report the Pi version, runtime version, and platform without including transcripts.
