import type { Theme } from "@earendil-works/pi-coding-agent";
import { DynamicBorder } from "@earendil-works/pi-coding-agent";
import type { Component, TUI } from "@earendil-works/pi-tui";
import { Container, Text, matchesKey } from "@earendil-works/pi-tui";
import { statusText, type TalkStatus } from "./status-view.js";

export type TalkOverlayResult =
	{ kind: "cancelled" } | { kind: "handoff"; text: string; warning?: string };

type OverlayPhase = TalkStatus;

export interface TalkOverlayOptions {
	tui: TUI;
	theme: Theme;
	done: (result: TalkOverlayResult) => void;
	onStop: () => void;
	onCancel: () => void;
}

/** Read-only recording overlay. Editing intentionally happens in Pi's regular editor. */
export class TalkOverlay extends Container implements Component {
	private readonly tui: TUI;
	private readonly theme: TalkOverlayOptions["theme"];
	private readonly done: TalkOverlayOptions["done"];
	private readonly onStop: () => void;
	private readonly onCancel: () => void;
	private phase: OverlayPhase = "starting_runtime";
	private text = "";
	private language = "auto";
	private speechEvent: "eou" | "eob" | undefined;
	private warning: string | undefined;
	private actionInFlight = false;

	constructor(options: TalkOverlayOptions) {
		super();
		this.tui = options.tui;
		this.theme = options.theme;
		this.done = options.done;
		this.onStop = options.onStop;
		this.onCancel = options.onCancel;
		this.rebuild();
	}

	setPhase(phase: OverlayPhase): void {
		this.phase = phase;
		this.rebuild();
		this.tui.requestRender();
	}

	setLanguage(language: string): void {
		this.language = language;
		this.rebuild();
		this.tui.requestRender();
	}

	appendTranscript(text: string): void {
		if (
			this.phase !== "recording" &&
			this.phase !== "finalizing" &&
			this.phase !== "error"
		)
			return;
		this.text += text;
		this.rebuild();
		this.tui.requestRender();
	}

	getTranscript(): string {
		return this.text;
	}

	setTranscript(text: string): void {
		this.text = text;
		this.rebuild();
		this.tui.requestRender();
	}

	setSpeechEvent(event: "eou" | "eob"): void {
		this.speechEvent = event;
		this.rebuild();
		this.tui.requestRender();
	}

	finish(text: string, warning?: string): void {
		if (this.actionInFlight) return;
		this.actionInFlight = true;
		this.done(
			warning ? { kind: "handoff", text, warning } : { kind: "handoff", text },
		);
	}

	fail(message: string, partialText: string): void {
		this.phase = "error";
		this.text = partialText;
		this.warning = message;
		this.rebuild();
		this.tui.requestRender();
	}

	handleInput(data: string): void {
		if (matchesKey(data, "escape")) {
			if (this.actionInFlight) return;
			this.actionInFlight = true;
			this.onCancel();
			return;
		}
		if (this.phase === "recording" && matchesKey(data, "enter")) {
			if (this.actionInFlight) return;
			this.phase = "finalizing";
			this.rebuild();
			this.tui.requestRender();
			this.onStop();
		}
	}

	private rebuild(): void {
		this.clear();
		this.addChild(
			new DynamicBorder((value: string) => this.theme.fg("accent", value)),
		);
		this.addChild(
			new Text(this.theme.fg("accent", this.theme.bold("🎙 Talk-to-Pi")), 1, 0),
		);
		this.addChild(
			new Text(this.text || this.theme.fg("dim", "Speak now…"), 1, 0),
		);

		const status =
			this.phase === "error"
				? this.warning || "Transcription failed"
				: statusText(this.phase, this.speechEvent);
		const language = this.phase === "recording" ? ` · ${this.language}` : "";
		this.addChild(
			new Text(
				this.theme.fg(
					this.phase === "error" ? "error" : "muted",
					`${status}${language}`,
				),
				1,
				0,
			),
		);

		const hint =
			this.phase === "recording"
				? "Enter stop · Esc discard"
				: this.phase === "finalizing"
					? "Finalizing… · Esc discard"
					: "Esc discard";
		this.addChild(new Text(this.theme.fg("dim", hint), 1, 0));
		this.addChild(
			new DynamicBorder((value: string) => this.theme.fg("accent", value)),
		);
	}
}
