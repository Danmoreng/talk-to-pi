import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type {
	ProvisionProgress,
	TalkRuntime,
} from "../runtime/runtime-manager.js";

const STATUS_ID = "talk-to-pi-download";
const WIDGET_ID = "talk-to-pi-download";

export class BackgroundProvisioner {
	private task: Promise<void> | undefined;
	private abortController: AbortController | undefined;
	private progress: ProvisionProgress | undefined;
	private renderedPercent: number | undefined;

	constructor(private readonly runtime: TalkRuntime) {}

	get isRunning(): boolean {
		return this.task !== undefined;
	}

	start(ctx: ExtensionContext): void {
		if (this.task) {
			this.showCurrentProgress(ctx);
			ctx.ui.notify("Talk-to-Pi assets are already downloading.", "info");
			return;
		}

		const abortController = new AbortController();
		this.abortController = abortController;
		this.progress = undefined;
		this.renderedPercent = undefined;
		this.renderWaiting(ctx);
		ctx.ui.notify(
			"Talk-to-Pi download started in the background. You can keep working.",
			"info",
		);

		const task = this.runtime
			.ensureProvisioned(
				(progress) => this.updateProgress(ctx, progress),
				abortController.signal,
			)
			.then(() => {
				if (abortController.signal.aborted) return;
				this.clearUi(ctx);
				ctx.ui.notify(
					"Talk-to-Pi is ready. Run /talk or use your configured shortcut to record.",
					"info",
				);
			})
			.catch((error: unknown) => {
				if (abortController.signal.aborted) return;
				this.clearUi(ctx);
				ctx.ui.notify(
					`Talk-to-Pi download failed: ${formatError(error)}`,
					"error",
				);
			})
			.finally(() => {
				if (this.task !== task) return;
				this.task = undefined;
				this.abortController = undefined;
				this.progress = undefined;
				this.renderedPercent = undefined;
			});
		this.task = task;
	}

	showCurrentProgress(ctx: ExtensionContext): void {
		if (this.progress) this.renderProgress(ctx, this.progress);
		else this.renderWaiting(ctx);
	}

	async cancel(ctx: ExtensionContext): Promise<void> {
		this.abortController?.abort();
		this.clearUi(ctx);
		await this.task;
	}

	private updateProgress(
		ctx: ExtensionContext,
		progress: ProvisionProgress,
	): void {
		this.progress = progress;
		const percent = progress.totalBytes
			? Math.min(
					100,
					Math.floor((progress.receivedBytes / progress.totalBytes) * 100),
				)
			: undefined;
		if (
			percent !== undefined &&
			percent === this.renderedPercent &&
			progress.receivedBytes !== progress.totalBytes
		)
			return;
		this.renderedPercent = percent;
		this.renderProgress(ctx, progress);
	}

	private renderWaiting(ctx: ExtensionContext): void {
		ctx.ui.setStatus(STATUS_ID, "voice ↓ preparing");
		ctx.ui.setWidget(
			WIDGET_ID,
			[ctx.ui.theme.fg("muted", "Talk-to-Pi: preparing download…")],
			{ placement: "belowEditor" },
		);
	}

	private renderProgress(
		ctx: ExtensionContext,
		progress: ProvisionProgress,
	): void {
		const ratio = progress.totalBytes
			? Math.min(1, progress.receivedBytes / progress.totalBytes)
			: 0;
		const percent = progress.totalBytes ? Math.floor(ratio * 100) : undefined;
		const width = 20;
		const filled = Math.round(ratio * width);
		const bar = `${"█".repeat(filled)}${"░".repeat(width - filled)}`;
		const asset = progress.asset === "model" ? "Model" : "Runtime";
		const bytes = progress.totalBytes
			? `${formatBytes(progress.receivedBytes)} / ${formatBytes(progress.totalBytes)}`
			: formatBytes(progress.receivedBytes);
		const label = `${asset} [${bar}]${percent === undefined ? "" : ` ${percent}%`} · ${bytes}`;
		ctx.ui.setStatus(
			STATUS_ID,
			`voice ↓ ${percent === undefined ? formatBytes(progress.receivedBytes) : `${percent}%`}`,
		);
		ctx.ui.setWidget(WIDGET_ID, [ctx.ui.theme.fg("accent", label)], {
			placement: "belowEditor",
		});
	}

	private clearUi(ctx: ExtensionContext): void {
		ctx.ui.setStatus(STATUS_ID, undefined);
		ctx.ui.setWidget(WIDGET_ID, undefined);
	}
}

function formatBytes(bytes: number): string {
	if (bytes < 1024 * 1024) return `${Math.floor(bytes / 1024)} KiB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}

function formatError(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
