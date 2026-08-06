import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerDoctorCommand } from "./command/doctor-command.js";
import { registerTalkCommand } from "./command/talk-command.js";
import { RuntimeManager } from "./runtime/runtime-manager.js";

export default function (pi: ExtensionAPI): void {
	const runtime = new RuntimeManager();
	registerTalkCommand(pi, runtime);
	registerDoctorCommand(pi, runtime);

	pi.on("session_start", async (_event, ctx) => {
		ctx.ui.setStatus("talk-to-pi", "Talk-to-Pi: ready on /talk");
	});

	pi.on("session_shutdown", async () => {
		await runtime.shutdown();
	});
}
