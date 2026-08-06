import { randomUUID } from "node:crypto";
import type {
	ExtensionAPI,
	ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import type { TalkConfig } from "../config/config.js";
import type { BackgroundProvisioner } from "../provisioning/background-provisioner.js";
import {
	configuredLanguage,
	resolveLanguage,
	type LanguageSetting,
} from "../config/language.js";
import { type RuntimeMessage } from "../runtime/protocol.js";
import { type TalkRuntime } from "../runtime/runtime-manager.js";
import { TalkOverlay, type TalkOverlayResult } from "../ui/talk-overlay.js";

function parseLanguage(args: string): LanguageSetting {
	const trimmed = args.trim();
	if (!trimmed) return configuredLanguage();
	const match = /^(?:--lang(?:=|\s+))([^\s]+)$/.exec(trimmed);
	if (!match?.[1]) throw new Error("Usage: /talk [--lang de-DE|auto]");
	return match[1];
}

function messageText(message: RuntimeMessage): string {
	return typeof message.message === "string"
		? message.message
		: "Talk-to-Pi runtime error.";
}

function messageSessionId(message: RuntimeMessage): string | undefined {
	return typeof message.sessionId === "string" ? message.sessionId : undefined;
}

export function appendTranscript(
	existingText: string,
	transcript: string,
): string {
	const trimmedTranscript = transcript.trim();
	if (!trimmedTranscript) return existingText;
	if (!existingText.trim()) return trimmedTranscript;
	return /\s$/u.test(existingText)
		? `${existingText}${trimmedTranscript}`
		: `${existingText} ${trimmedTranscript}`;
}

export function registerTalkCommand(
	pi: Pick<ExtensionAPI, "registerCommand" | "registerShortcut">,
	runtime: TalkRuntime,
	backgroundProvisioner: BackgroundProvisioner,
	config: TalkConfig,
): void {
	const handler = async (
		args: string,
		ctx: ExtensionContext,
	): Promise<void> => {
		if (ctx.mode !== "tui") {
			ctx.ui.notify("/talk requires interactive TUI mode.", "error");
			return;
		}
		if (backgroundProvisioner.isRunning) {
			backgroundProvisioner.showCurrentProgress(ctx);
			ctx.ui.notify(
				"Talk-to-Pi is still downloading in the background.",
				"info",
			);
			return;
		}
		// The recording overlay is independent of agent execution. The finalized
		// transcript is handed back to Pi's regular editor, where pressing Enter
		// uses Pi's normal queueing behavior while the agent is busy.
		const existingEditorText = ctx.ui.getEditorText();

		let languageSetting: LanguageSetting;
		try {
			languageSetting = args.trim()
				? parseLanguage(args)
				: configuredLanguage(process.env, config.language);
		} catch (error) {
			ctx.ui.notify(
				error instanceof Error ? error.message : String(error),
				"warning",
			);
			return;
		}
		let language: string;
		try {
			language = resolveLanguage(languageSetting);
		} catch (error) {
			ctx.ui.notify(
				error instanceof Error ? error.message : String(error),
				"warning",
			);
			return;
		}

		const diagnostics = await runtime.getDiagnostics();
		if (!diagnostics.modelInstalled) {
			const approved = await ctx.ui.confirm(
				"Download NVIDIA speech model?",
				`Talk-to-Pi needs approximately 742 MB in the Hugging Face cache:\n${diagnostics.modelPath}`,
			);
			if (!approved) {
				ctx.ui.notify("Talk-to-Pi model download cancelled.", "info");
				return;
			}
		}
		if (!diagnostics.modelInstalled || !diagnostics.runtimeInstalled) {
			backgroundProvisioner.start(ctx);
			return;
		}

		const sessionId = randomUUID();
		const abortController = new AbortController();
		let overlay: TalkOverlay | undefined;
		let recordingStarted = false;
		let stopRequested = false;
		let finalizationTimer: NodeJS.Timeout | undefined;

		const result = await ctx.ui.custom<TalkOverlayResult | undefined>(
			(tui, theme, _keybindings, done) => {
				overlay = new TalkOverlay({
					tui,
					theme,
					done,
					onStop: () => {
						if (stopRequested) return;
						stopRequested = true;
						void runtime.stopRecording(sessionId).catch((error: unknown) => {
							const partial = overlay;
							if (!partial) return;
							const text = partialText(partial);
							if (text.trim())
								partial.finish(
									text,
									error instanceof Error ? error.message : String(error),
								);
							else
								partial.fail(
									error instanceof Error ? error.message : String(error),
									"",
								);
						});
						finalizationTimer = setTimeout(() => {
							if (!overlay) return;
							const text = partialText(overlay);
							if (text.trim())
								overlay.finish(
									text,
									"Finalization timed out; transcript may be incomplete.",
								);
							else
								overlay.fail(
									"Finalization timed out and produced no text.",
									"",
								);
						}, 5_000);
					},
					onCancel: () => {
						abortController.abort();
						void (
							recordingStarted
								? runtime.cancelRecording(sessionId)
								: Promise.resolve()
						)
							.catch(() => undefined)
							.finally(() => done({ kind: "cancelled" }));
					},
				});
				overlay.setLanguage(language);

				const handleEvent = (message: RuntimeMessage): void => {
					if (
						messageSessionId(message) &&
						messageSessionId(message) !== sessionId
					)
						return;
					if (message.type === "recording_started") {
						recordingStarted = true;
						overlay?.setPhase("recording");
						return;
					}
					if (
						message.type === "transcript_update" &&
						typeof message.text === "string"
					) {
						overlay?.setTranscript(message.text);
						return;
					}
					if (
						message.type === "transcript_delta" &&
						typeof message.text === "string"
					) {
						overlay?.appendTranscript(message.text);
						return;
					}
					if (
						message.type === "speech_event" &&
						(message.event === "eou" || message.event === "eob")
					) {
						overlay?.setSpeechEvent(message.event);
						return;
					}
					if (
						message.type === "recording_finalized" &&
						typeof message.text === "string"
					) {
						if (finalizationTimer) clearTimeout(finalizationTimer);
						overlay?.finish(message.text);
						return;
					}
					if (message.type === "warning") {
						overlay?.warn(messageText(message));
						return;
					}
					if (message.type === "error") {
						const text = partialText(overlay);
						if (text.trim()) overlay?.finish(text, messageText(message));
						else overlay?.fail(messageText(message), "");
					}
				};

				void (async () => {
					try {
						overlay?.setPhase("provisioning");
						await runtime.ensureProvisioned(
							(progress) => overlay?.setProgress(progress),
							abortController.signal,
						);
						overlay?.setPhase("starting_runtime");
						await runtime.ensureReady(abortController.signal);
						await runtime.startRecording({
							sessionId,
							language,
							onEvent: handleEvent,
						});
					} catch (error) {
						if (abortController.signal.aborted) return;
						const text = partialText(overlay);
						if (text.trim())
							overlay?.finish(
								text,
								error instanceof Error ? error.message : String(error),
							);
						else
							overlay?.fail(
								error instanceof Error ? error.message : String(error),
								"",
							);
					}
				})();

				return overlay;
			},
			{
				overlay: true,
				overlayOptions: {
					width: "80%",
					minWidth: 48,
					maxHeight: "60%",
					anchor: "center",
				},
			},
		);

		abortController.abort();
		if (finalizationTimer) clearTimeout(finalizationTimer);
		if (result?.kind !== "handoff") return;

		const text = result.text.trim();
		if (!text) {
			ctx.ui.notify("The recording did not produce any text.", "info");
			return;
		}
		ctx.ui.setEditorText(appendTranscript(existingEditorText, text));
		if (result.warning) ctx.ui.notify(result.warning, "warning");
	};

	pi.registerCommand("talk", {
		description:
			"Transcribe into Pi's prompt editor, including while the agent is working",
		handler,
	});
	if (config.shortcut) {
		pi.registerShortcut(config.shortcut, {
			description: "Start Talk-to-Pi recording",
			handler: (ctx) => handler("", ctx),
		});
	}
}

function partialText(overlay: TalkOverlay | undefined): string {
	return overlay ? overlay.getTranscript() : "";
}
