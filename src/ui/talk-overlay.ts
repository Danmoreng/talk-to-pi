import type { Theme } from "@earendil-works/pi-coding-agent";
import type { Component, TUI } from "@earendil-works/pi-tui";
import {
	Container,
	Text,
	matchesKey,
	truncateToWidth,
	visibleWidth,
} from "@earendil-works/pi-tui";
import type { ProvisionProgress } from "../runtime/runtime-manager.js";
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
	private progress: ProvisionProgress | undefined;
	private renderedProgressPercent: number | undefined;
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

	setProgress(progress: ProvisionProgress): void {
		this.progress = progress;
		const percent = progress.totalBytes
			? Math.min(
					100,
					Math.floor((progress.receivedBytes / progress.totalBytes) * 100),
				)
			: undefined;
		if (
			percent !== undefined &&
			percent === this.renderedProgressPercent &&
			progress.receivedBytes !== progress.totalBytes
		)
			return;
		this.renderedProgressPercent = percent;
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

	warn(message: string): void {
		this.warning = message;
		this.rebuild();
		this.tui.requestRender();
	}

	finish(text: string, warning?: string): void {
		if (this.actionInFlight) return;
		this.actionInFlight = true;
		const finalWarning = warning ?? this.warning;
		this.done(
			finalWarning
				? { kind: "handoff", text, warning: finalWarning }
				: { kind: "handoff", text },
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

	override render(width: number): string[] {
		const innerWidth = Math.max(1, width - 2);
		const frame = (value: string): string => this.theme.fg("accent", value);
		const body = super.render(innerWidth).map((line) => {
			const content = truncateToWidth(line, innerWidth, "");
			const padding = " ".repeat(
				Math.max(0, innerWidth - visibleWidth(content)),
			);
			return `${frame("│")}${content}${padding}${frame("│")}`;
		});
		return [
			frame(`╭${"─".repeat(innerWidth)}╮`),
			...body,
			frame(`╰${"─".repeat(innerWidth)}╯`),
		];
	}

	private rebuild(): void {
		this.clear();
		this.addChild(
			new Text(this.theme.fg("accent", this.theme.bold("🎙 Talk-to-Pi")), 1, 0),
		);
		const placeholder =
			this.phase === "provisioning"
				? "Preparing local speech assets…"
				: this.phase === "starting_runtime"
					? "Loading speech model…"
					: "Speak now…";
		this.addChild(
			new Text(this.text || this.theme.fg("dim", placeholder), 1, 0),
		);
		if (this.phase === "provisioning" && this.progress)
			this.addChild(new Text(this.renderProgress(this.progress), 1, 0));

		const status =
			this.phase === "error"
				? this.warning || "Transcription failed"
				: this.warning || statusText(this.phase, this.speechEvent);
		const language = this.phase === "recording" ? ` · ${this.language}` : "";
		this.addChild(
			new Text(
				this.theme.fg(
					this.phase === "error" ? "error" : this.warning ? "warning" : "muted",
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
	}

	private renderProgress(progress: ProvisionProgress): string {
		const width = 20;
		const total = progress.totalBytes;
		const ratio = total ? Math.min(1, progress.receivedBytes / total) : 0;
		const filled = Math.round(ratio * width);
		const bar = `${"█".repeat(filled)}${"░".repeat(width - filled)}`;
		const asset = progress.asset === "model" ? "Model" : "Runtime";
		const percent = total ? ` ${Math.floor(ratio * 100)}%` : "";
		const bytes = total
			? `${formatBytes(progress.receivedBytes)} / ${formatBytes(total)}`
			: formatBytes(progress.receivedBytes);
		return this.theme.fg("accent", `${asset} [${bar}]${percent} · ${bytes}`);
	}
}

function formatBytes(bytes: number): string {
	if (bytes < 1024 * 1024) return `${Math.floor(bytes / 1024)} KiB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}
