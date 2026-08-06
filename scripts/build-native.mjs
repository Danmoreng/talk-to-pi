import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);
const buildDir = resolve(root, "native", "build");
mkdirSync(buildDir, { recursive: true });
execFileSync(
	"cmake",
	[
		"-S",
		resolve(root, "native"),
		"-B",
		buildDir,
		"-DTALK_TO_PI_BUILD_TESTS=ON",
	],
	{ stdio: "inherit" },
);
execFileSync("cmake", ["--build", buildDir, "--parallel"], {
	stdio: "inherit",
});
