# Troubleshooting

## `/talk` says the runtime is not provisioned

For local development, start Pi with `npm run local:pi`; it supplies the locally generated parakeet.cpp model and native runtime through explicit path overrides. Run `/talk-doctor` to inspect them. Release provisioning is not enabled until the model artifact has been published with a stable URL and checksum.

## Tastenkürzel funktioniert nicht

`Ctrl+R` ist als Extension-Shortcut registriert und startet denselben Ablauf wie
`/talk`. Starte Pi mit der Talk-to-Pi-Extension, beispielsweise über
`npm run local:pi`. Bei einer bereits laufenden Pi-Sitzung `/reload` ausführen
oder Pi neu starten.

## Sprache ändern

Die Standardsprache ist `auto`. Für alle Aufnahmen kann beispielsweise
`TALK_TO_PI_LANGUAGE=de-DE` gesetzt werden. Einzelne Aufnahmen überschreiben
die Einstellung mit `/talk --lang en-US` oder `/talk --lang auto`.

## No microphone

The runtime uses the system default capture device. Check the default input device and run `/talk-doctor`. Device selection is intentionally outside the MVP.

## Runtime process remains after reload

The extension sends a protocol shutdown, then escalates to SIGTERM and SIGKILL. Capture the stderr diagnostics from `/talk-doctor` and report the Pi version, runtime version, and platform without including transcripts.
