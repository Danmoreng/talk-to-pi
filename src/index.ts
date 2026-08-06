import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerDoctorCommand } from "./command/doctor-command.js";
import { registerTalkCommand } from "./command/talk-command.js";
import { RuntimeManager } from "./runtime/runtime-manager.js";

export default function (pi: ExtensionAPI): void {
	const runtime = new RuntimeManager();
	registerTalkCommand(pi, runtime);
	registerDoctorCommand(pi, runtime);

	pi.on("session_start", async () => {
		// Warm the native process before the user invokes /talk. Do not trigger a
		// model download here; first-use consent remains in /talk.
		const diagnostics = await runtime.getDiagnostics();
		if (!diagnostics.runtimeInstalled || !diagnostics.modelInstalled) return;
		try {
			await runtime.ensureReady();
		} catch {
			// /talk retries and presents the actionable provisioning error.
		}
	});

	pi.on("session_shutdown", async () => {
		await runtime.shutdown();
	});
}
