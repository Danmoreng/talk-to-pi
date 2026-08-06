import { describe, expect, it, vi } from "vitest";
import { TalkOverlay } from "../../src/ui/talk-overlay.js";

function createOverlay() {
	const tui = { requestRender: vi.fn() } as never;
	const done = vi.fn();
	const onStop = vi.fn();
	const onCancel = vi.fn();
	const overlay = new TalkOverlay({
		tui,
		theme: {
			fg: (_color: never, text: string) => text,
			bold: (text: string) => text,
		} as never,
		done,
		onStop,
		onCancel,
	});
	return { overlay, done, onStop, onCancel };
}

describe("recording overlay", () => {
	it("renders a complete centered-style frame", () => {
		const { overlay } = createOverlay();
		const lines = overlay.render(24);
		expect(lines[0]).toMatch(/^╭─+╮$/u);
		expect(lines.at(-1)).toMatch(/^╰─+╯$/u);
		expect(lines.slice(1, -1).every((line) => line.startsWith("│"))).toBe(true);
		expect(lines.slice(1, -1).every((line) => line.endsWith("│"))).toBe(true);
	});

	it("stops on Enter but does not submit", () => {
		const { overlay, done, onStop } = createOverlay();
		overlay.setPhase("recording");
		overlay.handleInput("\r");
		expect(onStop).toHaveBeenCalledOnce();
		expect(done).not.toHaveBeenCalled();
	});

	it("cancels on Escape", () => {
		const { overlay, done, onCancel } = createOverlay();
		overlay.handleInput("\u001b");
		expect(onCancel).toHaveBeenCalledOnce();
		expect(done).not.toHaveBeenCalled();
	});

	it("returns text only through explicit handoff", () => {
		const { overlay, done } = createOverlay();
		overlay.setPhase("recording");
		overlay.appendTranscript(" Hallo ");
		overlay.finish(" Hallo ");
		expect(done).toHaveBeenCalledWith({ kind: "handoff", text: " Hallo " });
	});

	it("renders model download progress", () => {
		const { overlay } = createOverlay();
		overlay.setPhase("provisioning");
		overlay.setProgress({
			asset: "model",
			receivedBytes: 50 * 1024 * 1024,
			totalBytes: 100 * 1024 * 1024,
		});
		const rendered = overlay.render(72).join("\n");
		expect(rendered).toContain("Model [██████████░░░░░░░░░░] 50%");
		expect(rendered).toContain("50.0 MiB / 100.0 MiB");
	});

	it("keeps a recoverable warning for editor handoff", () => {
		const { overlay, done } = createOverlay();
		overlay.setPhase("recording");
		overlay.warn("Audio frames were dropped.");
		overlay.finish("Partial text");
		expect(done).toHaveBeenCalledWith({
			kind: "handoff",
			text: "Partial text",
			warning: "Audio frames were dropped.",
		});
	});
});
