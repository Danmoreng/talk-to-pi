import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";

const [file, url] = process.argv.slice(2);
if (!file || !url)
	throw new Error("Usage: node scripts/create-release-manifest.mjs FILE URL");
const bytes = await readFile(file);
const info = await stat(file);
console.log(
	JSON.stringify(
		{
			url,
			sizeBytes: info.size,
			sha256: createHash("sha256").update(bytes).digest("hex"),
		},
		null,
		2,
	),
);
