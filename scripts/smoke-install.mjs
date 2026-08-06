import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const directory = await mkdtemp(join(tmpdir(), "talk-to-pi-smoke-"));
try {
	const packageJson = JSON.parse(await readFile("package.json", "utf8"));
	if (
		packageJson.scripts?.postinstall ||
		packageJson.scripts?.install ||
		packageJson.scripts?.preinstall
	) {
		throw new Error("Package must not define npm lifecycle scripts");
	}
	await writeFile(join(directory, "marker"), "ok");
	execFileSync(process.execPath, ["-e", "console.log('smoke ok')"], {
		stdio: "inherit",
	});
} finally {
	await rm(directory, { recursive: true, force: true });
}
