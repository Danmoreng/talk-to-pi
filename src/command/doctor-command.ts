import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { getTalkPaths, PACKAGE_VERSION } from "../config/paths.js";
import { type TalkRuntime } from "../runtime/runtime-manager.js";

export function registerDoctorCommand(
	pi: Pick<ExtensionAPI, "registerCommand">,
	runtime: TalkRuntime,
): void {
	pi.registerCommand("talk-doctor", {
		description: "Show Talk-to-Pi installation and runtime diagnostics",
		handler: async (_args, ctx) => {
			const diagnostics = await runtime.getDiagnostics();
			const paths = getTalkPaths();
			const lines = [
				`Talk-to-Pi ${PACKAGE_VERSION}`,
				`Pi mode: ${ctx.mode}`,
				`Platform: ${process.platform}-${process.arch}`,
				`Node: ${process.version}`,
				`Runtime path: ${diagnostics.runtimePath}`,
				`Runtime installed: ${diagnostics.runtimeInstalled ? "yes" : "no"}`,
				`Model path: ${diagnostics.modelPath}`,
				`Model installed: ${diagnostics.modelInstalled ? "yes" : "no"}`,
				`Runtime process: ${diagnostics.processAlive ? "alive" : "not running"}`,
			];
			if (diagnostics.stderr.trim())
				lines.push("Runtime diagnostics:", diagnostics.stderr.trim());
			ctx.ui.notify(
				lines.join("\n"),
				diagnostics.runtimeInstalled && diagnostics.modelInstalled
					? "info"
					: "warning",
			);
		},
	});
}
