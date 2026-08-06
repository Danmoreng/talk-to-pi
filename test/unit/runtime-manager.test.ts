import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { RuntimeManager } from "../../src/runtime/runtime-manager.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
	await Promise.all(
		temporaryDirectories
			.splice(0)
			.map((path) => rm(path, { recursive: true, force: true })),
	);
});

describe("runtime recovery", () => {
	it("restarts the child process after a terminal recording error", async () => {
		const directory = await mkdtemp(join(tmpdir(), "talk-to-pi-runtime-"));
		temporaryDirectories.push(directory);
		const runtimePath = join(directory, "fake-runtime.mjs");
		const modelPath = join(directory, "model.gguf");
		const launchesPath = join(directory, "launches.txt");
		await writeFile(modelPath, "model");
		await writeFile(
			runtimePath,
			`#!/usr/bin/env node
import { appendFileSync } from "node:fs";
import { createInterface } from "node:readline";
appendFileSync(${JSON.stringify(launchesPath)}, "launch\\n");
let seq = 0;
const emit = (message) => process.stdout.write(JSON.stringify({ v: 1, seq: ++seq, ...message }) + "\\n");
emit({ type: "hello", runtimeVersion: "0.1.0", protocolVersions: [1], nemoAbi: 1, engine: "nemo-speech.cpp" });
setTimeout(() => emit({ type: "ready", engine: "nemo-speech.cpp" }), 20);
createInterface({ input: process.stdin }).on("line", (line) => {
  const command = JSON.parse(line);
  if (command.type === "start") {
    emit({ type: "command_ack", id: command.id, command: "start", sessionId: command.sessionId });
    setTimeout(() => emit({ type: "error", sessionId: command.sessionId, code: "TRANSCRIPTION_FAILED", message: "decode failed", recoverable: false }), 5);
  } else if (command.type === "shutdown") {
    emit({ type: "command_ack", id: command.id, command: "shutdown" });
    process.exit(0);
  } else {
    emit({ type: "command_ack", id: command.id, command: command.type, sessionId: command.sessionId });
  }
});
`,
		);
		await chmod(runtimePath, 0o755);

		const previousRuntime = process.env.TALK_TO_PI_RUNTIME_PATH;
		const previousModel = process.env.TALK_TO_PI_MODEL_PATH;
		process.env.TALK_TO_PI_RUNTIME_PATH = runtimePath;
		process.env.TALK_TO_PI_MODEL_PATH = modelPath;
		const runtime = new RuntimeManager();
		try {
			const events: string[] = [];
			await runtime.startRecording({
				sessionId: "session-1",
				language: "auto",
				onEvent: (message) => events.push(message.type),
			});
			await waitFor(async () => {
				const launches = await readFile(launchesPath, "utf8");
				return (
					launches.trim().split("\n").length >= 2 &&
					(await runtime.getDiagnostics()).processAlive
				);
			});
			expect(events).toContain("error");
		} finally {
			await runtime.shutdown();
			if (previousRuntime === undefined)
				delete process.env.TALK_TO_PI_RUNTIME_PATH;
			else process.env.TALK_TO_PI_RUNTIME_PATH = previousRuntime;
			if (previousModel === undefined) delete process.env.TALK_TO_PI_MODEL_PATH;
			else process.env.TALK_TO_PI_MODEL_PATH = previousModel;
		}
	}, 10_000);
});

async function waitFor(predicate: () => Promise<boolean>): Promise<void> {
	const deadline = Date.now() + 5_000;
	while (!(await predicate())) {
		if (Date.now() >= deadline)
			throw new Error("Timed out waiting for runtime restart.");
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
}
