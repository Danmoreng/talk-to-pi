import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";

const [file, expectedSize, expectedSha256] = process.argv.slice(2);
if (!file || !expectedSize || !expectedSha256)
	throw new Error(
		"Usage: node scripts/verify-release-assets.mjs FILE SIZE SHA256",
	);
const info = await stat(file);
const digest = createHash("sha256")
	.update(await readFile(file))
	.digest("hex");
if (info.size !== Number(expectedSize))
	throw new Error(`Size mismatch: ${info.size} != ${expectedSize}`);
if (digest !== expectedSha256.toLowerCase())
	throw new Error(`SHA-256 mismatch: ${digest} != ${expectedSha256}`);
console.log(`Verified ${file}: ${info.size} bytes, ${digest}`);
