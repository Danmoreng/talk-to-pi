import { readFile } from "node:fs/promises";

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const manifest = JSON.parse(
	await readFile("manifests/runtime-v1.json", "utf8"),
);
const expectedTag = `v${packageJson.version}`;
const releaseTag = `runtime-v${packageJson.version}`;
const suppliedTag = process.argv[2] || process.env.GITHUB_REF_NAME;
if (suppliedTag && suppliedTag !== expectedTag)
	throw new Error(
		`npm release tag ${suppliedTag} does not match package version ${expectedTag}.`,
	);
if (manifest.runtimeVersion !== packageJson.version)
	throw new Error(
		`Runtime manifest ${manifest.runtimeVersion} does not match package ${packageJson.version}.`,
	);
const requiredPlatforms = [
	"linux-x64-cpu",
	"linux-arm64-cpu",
	"darwin-x64-cpu",
	"darwin-arm64-cpu",
	"win32-x64-cpu",
];
for (const platform of requiredPlatforms) {
	const artifact = manifest.artifacts?.[platform];
	if (!artifact) throw new Error(`Runtime manifest is missing ${platform}.`);
	const expectedUrlPrefix = `https://github.com/Danmoreng/talk-to-pi/releases/download/${releaseTag}/`;
	if (!artifact.url?.startsWith(expectedUrlPrefix))
		throw new Error(
			`${platform} does not use immutable release ${releaseTag}.`,
		);
	if (!/^[a-f0-9]{64}$/.test(artifact.sha256) || artifact.sizeBytes <= 0)
		throw new Error(`${platform} has invalid integrity metadata.`);
}
console.log(
	`Publish checks passed for talk-to-pi@${packageJson.version} (${requiredPlatforms.length} native targets).`,
);
