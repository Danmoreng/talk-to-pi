import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const root = fileURLToPath(new URL("..", import.meta.url));
const arguments_ = process.argv.slice(2);
let buildDir = resolve(root, "native", "build");
let release = false;

for (let index = 0; index < arguments_.length; index += 1) {
	const argument = arguments_[index];
	if (argument === "--release") {
		release = true;
	} else if (argument === "--build-dir" && arguments_[index + 1]) {
		buildDir = resolve(arguments_[++index]);
	} else {
		throw new Error(`Unknown native build argument: ${argument}`);
	}
}

mkdirSync(buildDir, { recursive: true });
const configureArguments = [
	"-S",
	resolve(root, "native"),
	"-B",
	buildDir,
	`-DTALK_TO_PI_BUILD_TESTS=${release ? "OFF" : "ON"}`,
];
if (release) {
	configureArguments.push("-DCMAKE_BUILD_TYPE=Release");
	if (process.platform === "darwin")
		configureArguments.push("-DCMAKE_OSX_DEPLOYMENT_TARGET=13.0");
}
execFileSync("cmake", configureArguments, { stdio: "inherit" });

const buildArguments = ["--build", buildDir, "--parallel"];
if (release) buildArguments.push("--config", "Release");
execFileSync("cmake", buildArguments, { stdio: "inherit" });
