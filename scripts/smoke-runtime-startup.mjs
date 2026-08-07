import { spawn } from "node:child_process";
import { delimiter, dirname, join, resolve } from "node:path";

const arguments_ = process.argv.slice(2);
let runtimePath;
let modelPath;

for (let index = 0; index < arguments_.length; index += 1) {
	const argument = arguments_[index];
	if (argument === "--runtime" && arguments_[index + 1]) {
		runtimePath = resolve(arguments_[++index]);
	} else if (argument === "--model" && arguments_[index + 1]) {
		modelPath = resolve(arguments_[++index]);
	} else {
		throw new Error(`Unknown runtime smoke-test argument: ${argument}`);
	}
}

if (!runtimePath || !modelPath) {
	throw new Error(
		"Usage: node scripts/smoke-runtime-startup.mjs --runtime EXECUTABLE --model MODEL.gguf",
	);
}

const env = { ...process.env };
const libraryVariable =
	process.platform === "win32"
		? "PATH"
		: process.platform === "darwin"
			? "DYLD_LIBRARY_PATH"
			: "LD_LIBRARY_PATH";
const libraryDir = join(dirname(runtimePath), "lib");
env[libraryVariable] = env[libraryVariable]
	? `${libraryDir}${delimiter}${env[libraryVariable]}`
	: libraryDir;

const child = spawn(
	runtimePath,
	["--stdio", "--model", modelPath, "--protocol-version", "1"],
	{
		stdio: ["pipe", "pipe", "pipe"],
		shell: false,
		windowsHide: true,
		env,
	},
);

let stdout = "";
let stderr = "";
let ready = false;
let shutdownComplete = false;
let failed = false;

const timeout = setTimeout(() => {
	child.kill();
	fail("Runtime did not complete its startup smoke test within 90 seconds.");
}, 90_000);

child.stderr.setEncoding("utf8");
child.stderr.on("data", (chunk) => {
	stderr = `${stderr}${chunk}`.slice(-32 * 1024);
});

child.stdout.setEncoding("utf8");
child.stdout.on("data", (chunk) => {
	stdout += chunk;
	for (;;) {
		const newline = stdout.indexOf("\n");
		if (newline < 0) break;
		const line = stdout.slice(0, newline).trim();
		stdout = stdout.slice(newline + 1);
		if (!line) continue;
		let message;
		try {
			message = JSON.parse(line);
		} catch (error) {
			fail(`Runtime emitted invalid JSON: ${error.message}`);
			return;
		}
		if (message.type === "error") {
			fail(`Runtime startup error: ${message.code}: ${message.message}`);
		}
		if (message.type === "ready" && !ready) {
			ready = true;
			child.stdin.write(
				`${JSON.stringify({ v: 1, id: "smoke-shutdown", type: "shutdown" })}\n`,
			);
		}
		if (message.type === "shutdown_complete") shutdownComplete = true;
	}
});

child.on("error", (error) =>
	fail(`Runtime could not be started: ${error.message}`),
);
child.on("exit", (code, signal) => {
	clearTimeout(timeout);
	if (failed) return;
	if (code !== 0 || !ready || !shutdownComplete) {
		fail(
			`Runtime smoke test failed (${signal ? `signal ${signal}` : `exit code ${code}`}).`,
		);
		return;
	}
	console.log("Runtime loaded the model, became ready, and shut down cleanly.");
});

function fail(message) {
	if (failed) return;
	failed = true;
	clearTimeout(timeout);
	if (child.exitCode === null && !child.killed) child.kill();
	const detail = stderr.trim() ? `\nRuntime stderr:\n${stderr.trim()}` : "";
	console.error(`${message}${detail}`);
	process.exitCode = 1;
}
