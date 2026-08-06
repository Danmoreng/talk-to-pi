import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerConfigCommand } from "./command/config-command.js";
import { registerDoctorCommand } from "./command/doctor-command.js";
import { registerTalkCommand } from "./command/talk-command.js";
import { loadTalkConfigSync } from "./config/config.js";
import { BackgroundProvisioner } from "./provisioning/background-provisioner.js";
import { RuntimeManager } from "./runtime/runtime-manager.js";

export default function (pi: ExtensionAPI): void {
	const loadedConfig = loadTalkConfigSync();
	const runtime = new RuntimeManager();
	const backgroundProvisioner = new BackgroundProvisioner(runtime);
	registerTalkCommand(pi, runtime, backgroundProvisioner, loadedConfig.config);
	registerDoctorCommand(pi, runtime, loadedConfig);
	registerConfigCommand(pi, loadedConfig);

	pi.on("session_start", async (_event, ctx) => {
		if (loadedConfig.error)
			ctx.ui.notify(
				`Invalid Talk-to-Pi config at ${loadedConfig.path}; using defaults: ${loadedConfig.error}`,
				"warning",
			);
		if (!loadedConfig.config.prewarm) return;
		// Prewarming is opt-in because it keeps the native model resident for the
		// complete Pi session. It never triggers the first-use model download.
		const diagnostics = await runtime.getDiagnostics();
		if (!diagnostics.runtimeInstalled || !diagnostics.modelInstalled) return;
		try {
			await runtime.ensureReady();
		} catch {
			// /talk retries and presents the actionable provisioning error.
		}
	});

	pi.on("session_shutdown", async (_event, ctx) => {
		await backgroundProvisioner.cancel(ctx);
		await runtime.shutdown();
	});
}
