import { describe, expect, it, vi } from "vitest";
import { BackgroundProvisioner } from "../../src/provisioning/background-provisioner.js";
import type { ProvisionProgress } from "../../src/runtime/runtime-manager.js";

describe("background provisioning", () => {
	it("returns immediately and renders non-blocking download progress", async () => {
		let complete: (() => void) | undefined;
		const finished = new Promise<void>((resolve) => {
			complete = resolve;
		});
		const ensureProvisioned = vi.fn(
			(onProgress?: (progress: ProvisionProgress) => void) => {
				onProgress?.({
					asset: "model",
					receivedBytes: 50 * 1024 * 1024,
					totalBytes: 100 * 1024 * 1024,
				});
				return finished;
			},
		);
		const setStatus = vi.fn();
		const setWidget = vi.fn();
		const notify = vi.fn();
		const provisioner = new BackgroundProvisioner({
			ensureProvisioned,
		} as never);
		const ctx = {
			ui: {
				setStatus,
				setWidget,
				notify,
				theme: { fg: (_color: string, text: string) => text },
			},
		} as never;

		provisioner.start(ctx);
		expect(provisioner.isRunning).toBe(true);
		expect(ensureProvisioned).toHaveBeenCalledOnce();
		expect(setStatus).toHaveBeenCalledWith(
			"talk-to-pi-download",
			"voice ↓ 50%",
		);
		expect(setWidget.mock.calls.at(-1)?.[1]).toEqual([
			"Model [██████████░░░░░░░░░░] 50% · 50.0 MiB / 100.0 MiB",
		]);
		expect(notify).toHaveBeenCalledWith(
			"Talk-to-Pi download started in the background. You can keep working.",
			"info",
		);

		complete?.();
		await finished;
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(provisioner.isRunning).toBe(false);
		expect(notify).toHaveBeenCalledWith(
			"Talk-to-Pi is ready. Run /talk or use your configured shortcut to record.",
			"info",
		);
		expect(setWidget).toHaveBeenLastCalledWith(
			"talk-to-pi-download",
			undefined,
		);
	});
});
