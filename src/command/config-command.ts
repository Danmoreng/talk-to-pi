import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
	readTalkConfigText,
	writeTalkConfig,
	type LoadedTalkConfig,
} from "../config/config.js";

export function registerConfigCommand(
	pi: Pick<ExtensionAPI, "registerCommand">,
	loaded: LoadedTalkConfig,
): void {
	pi.registerCommand("talk-config", {
		description: "Edit the persistent Talk-to-Pi configuration",
		handler: async (_args, ctx) => {
			if (!ctx.hasUI) return;
			let current: string;
			try {
				current = await readTalkConfigText(loaded.path);
			} catch (error) {
				ctx.ui.notify(formatError(error), "error");
				return;
			}

			const edited = await ctx.ui.editor("Talk-to-Pi config (JSON)", current);
			if (edited === undefined) return;
			try {
				await writeTalkConfig(loaded.path, edited);
			} catch (error) {
				ctx.ui.notify(`Config not saved: ${formatError(error)}`, "error");
				return;
			}
			ctx.ui.notify(`Saved ${loaded.path}. Reloading Talk-to-Pi…`, "info");
			await ctx.reload();
		},
	});
}

function formatError(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
