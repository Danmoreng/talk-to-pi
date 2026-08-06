import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
	chmod,
	copyFile,
	cp,
	mkdir,
	readdir,
	readFile,
	rm,
	stat,
	writeFile,
} from "node:fs/promises";
import { delimiter, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as tar from "tar";

const root = fileURLToPath(new URL("..", import.meta.url));
const arguments_ = process.argv.slice(2);
let buildDir = resolve(root, "native", "build-release");
let outputDir = resolve(root, "artifacts");

for (let index = 0; index < arguments_.length; index += 1) {
	const argument = arguments_[index];
	if (argument === "--build-dir" && arguments_[index + 1]) {
		buildDir = resolve(arguments_[++index]);
	} else if (argument === "--output-dir" && arguments_[index + 1]) {
		outputDir = resolve(arguments_[++index]);
	} else {
		throw new Error(`Unknown runtime packaging argument: ${argument}`);
	}
}

const packageJson = JSON.parse(
	await readFile(resolve(root, "package.json"), "utf8"),
);
const platformKey = runtimePlatformKey(process.platform, process.arch);
const executable =
	process.platform === "win32"
		? "talk-to-pi-runtime.exe"
		: "talk-to-pi-runtime";
const installDir = join(buildDir, "package-install");
const packageRoot = join(buildDir, "package-root");
await Promise.all([
	rm(installDir, { recursive: true, force: true }),
	rm(packageRoot, { recursive: true, force: true }),
	mkdir(outputDir, { recursive: true }),
]);
await mkdir(packageRoot, { recursive: true });

const installArguments = ["--install", buildDir, "--prefix", installDir];
if (process.platform === "win32") installArguments.push("--config", "Release");
execFileSync("cmake", installArguments, { stdio: "inherit" });

await copyFile(join(installDir, executable), join(packageRoot, executable));
if (process.platform !== "win32")
	await chmod(join(packageRoot, executable), 0o755);

const librarySource = join(installDir, "lib");
const libraryDestination = join(packageRoot, "lib");
await mkdir(libraryDestination, { recursive: true });
for (const source of await sharedLibraries(librarySource)) {
	await copyFile(
		source,
		join(libraryDestination, source.split(/[\\/]/).at(-1)),
	);
}

const licensesDestination = join(packageRoot, "licenses");
await mkdir(licensesDestination, { recursive: true });
for (const source of [
	join(installDir, "licenses"),
	join(installDir, "share", "licenses", "nemo-speech"),
]) {
	try {
		await cp(
			source,
			join(
				licensesDestination,
				source === join(installDir, "licenses") ? "talk-to-pi" : "nemo-speech",
			),
			{
				recursive: true,
			},
		);
	} catch (error) {
		if (error?.code !== "ENOENT") throw error;
	}
}

const runtimePath = join(packageRoot, executable);
const environment = { ...process.env };
const libraryVariable =
	process.platform === "win32"
		? "PATH"
		: process.platform === "darwin"
			? "DYLD_LIBRARY_PATH"
			: "LD_LIBRARY_PATH";
environment[libraryVariable] = environment[libraryVariable]
	? `${libraryDestination}${delimiter}${environment[libraryVariable]}`
	: libraryDestination;
execFileSync(runtimePath, ["--version"], {
	stdio: "inherit",
	env: environment,
});

const archiveName = `talk-to-pi-runtime-${packageJson.version}-${platformKey}.tar.gz`;
const archivePath = join(outputDir, archiveName);
await rm(archivePath, { force: true });
await tar.create(
	{
		cwd: packageRoot,
		file: archivePath,
		gzip: true,
		portable: true,
		strict: true,
	},
	[executable, "lib", "licenses"],
);
const bytes = await readFile(archivePath);
const metadata = {
	platformKey,
	archiveName,
	artifact: {
		sha256: createHash("sha256").update(bytes).digest("hex"),
		sizeBytes: (await stat(archivePath)).size,
		archiveType: "tar.gz",
		executable,
	},
};
await writeFile(
	join(outputDir, `${platformKey}.json`),
	`${JSON.stringify(metadata, null, 2)}\n`,
);
console.log(JSON.stringify(metadata, null, 2));

async function sharedLibraries(directory) {
	const result = [];
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		const path = join(directory, entry.name);
		if (entry.isDirectory()) {
			result.push(...(await sharedLibraries(path)));
		} else if (
			(process.platform === "win32" && entry.name.endsWith(".dll")) ||
			(process.platform === "darwin" && entry.name.includes(".dylib")) ||
			(process.platform === "linux" && entry.name.includes(".so"))
		) {
			result.push(path);
		}
	}
	return result.sort();
}

function runtimePlatformKey(platform, arch) {
	const key = `${platform}-${arch}-cpu`;
	const supported = new Set([
		"linux-x64-cpu",
		"linux-arm64-cpu",
		"darwin-x64-cpu",
		"darwin-arm64-cpu",
		"win32-x64-cpu",
	]);
	if (!supported.has(key))
		throw new Error(`Unsupported runtime release target: ${platform}-${arch}`);
	return key;
}
