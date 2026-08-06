import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";

const [directoryArgument, tagArgument] = process.argv.slice(2);
if (!directoryArgument || !tagArgument)
	throw new Error(
		"Usage: node scripts/create-runtime-manifest.mjs DIRECTORY runtime-vVERSION",
	);
if (!/^runtime-v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(tagArgument))
	throw new Error(`Invalid runtime release tag: ${tagArgument}`);

const directory = resolve(directoryArgument);
const repository = process.env.GITHUB_REPOSITORY || "Danmoreng/talk-to-pi";
const runtimeVersion = tagArgument.slice("runtime-v".length);
const metadataFiles = (await readdir(directory))
	.filter((file) => /^(linux|darwin|win32)-.+-cpu\.json$/.test(file))
	.sort();
if (metadataFiles.length === 0)
	throw new Error(`No runtime metadata files found in ${directory}.`);

const artifacts = {};
const checksumLines = [];
for (const metadataFile of metadataFiles) {
	const metadata = JSON.parse(
		await readFile(join(directory, metadataFile), "utf8"),
	);
	const archivePath = join(directory, metadata.archiveName);
	const archive = await readFile(archivePath);
	const sha256 = createHash("sha256").update(archive).digest("hex");
	if (
		sha256 !== metadata.artifact.sha256 ||
		archive.byteLength !== metadata.artifact.sizeBytes
	)
		throw new Error(`Runtime metadata mismatch for ${metadata.archiveName}.`);
	artifacts[metadata.platformKey] = {
		url: `https://github.com/${repository}/releases/download/${tagArgument}/${metadata.archiveName}`,
		...metadata.artifact,
	};
	checksumLines.push(`${sha256}  ${basename(archivePath)}`);
}

const manifest = {
	schemaVersion: 1,
	runtimeVersion,
	protocolVersion: 1,
	artifacts,
};
await writeFile(
	join(directory, "runtime-v1.json"),
	`${JSON.stringify(manifest, null, 2)}\n`,
);
await writeFile(join(directory, "SHA256SUMS"), `${checksumLines.join("\n")}\n`);
console.log(JSON.stringify(manifest, null, 2));
