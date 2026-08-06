# Troubleshooting

## `/talk` says the runtime is not provisioned

For local development, start Pi with `npm run local:pi`; it supplies the locally built NeMo-Speech.cpp runtime. On the first `/talk`, approve the download of the pinned NVIDIA Q8_0 model into the Hugging Face cache. The download runs in the background with progress below Pi's editor; invoke `/talk` again after the ready notification. Run `/talk-doctor` to inspect the resolved paths. Release provisioning remains gated until a stable, verified native runtime archive is published.

## Tastenkürzel funktioniert nicht

`Alt+R` ist standardmäßig als Extension-Shortcut registriert und startet
denselben Ablauf wie `/talk`. Mit `/talk-config` kann der Shortcut dauerhaft
geändert oder mit `null` deaktiviert werden. Starte Pi mit der Talk-to-Pi-
Extension, beispielsweise über `npm run local:pi`. Nach einer manuellen
Änderung der Konfigurationsdatei `/reload` ausführen oder Pi neu starten.

## Sprache ändern

Die Standardsprache ist `auto`. Mit `/talk-config` kann beispielsweise
`de-DE` dauerhaft gesetzt werden. Einzelne Aufnahmen überschreiben die
Einstellung mit `/talk --lang en-US` oder `/talk --lang auto`. Die Variable
`TALK_TO_PI_LANGUAGE` bleibt als temporärer Shell-Override verfügbar.

## No microphone

The runtime uses the system default capture device. Check the default input device and run `/talk-doctor`. Device selection is intentionally outside the MVP.

## Runtime process remains after reload

The extension sends a protocol shutdown, then escalates to SIGTERM and SIGKILL. Capture the stderr diagnostics from `/talk-doctor` and report the Pi version, runtime version, and platform without including transcripts.
