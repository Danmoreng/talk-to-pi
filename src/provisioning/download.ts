import { createHash } from "node:crypto";
import { open, rename, rm, stat, unlink, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export interface VerifiedAsset {
	url: string;
	destination: string;
	sha256: string;
	sizeBytes: number;
}

export interface DownloadProgress {
	receivedBytes: number;
	totalBytes?: number;
}

export async function verifyFile(
	path: string,
	expectedSize: number,
	expectedSha256: string,
): Promise<boolean> {
	try {
		const info = await stat(path);
		if (!info.isFile() || info.size !== expectedSize) return false;
		const digest = createHash("sha256");
		const file = await open(path, "r");
		try {
			for await (const chunk of file.readableWebStream())
				digest.update(Buffer.from(chunk));
		} finally {
			await file.close();
		}
		return digest.digest("hex") === expectedSha256.toLowerCase();
	} catch {
		return false;
	}
}

export async function downloadVerified(
	asset: VerifiedAsset,
	onProgress?: (progress: DownloadProgress) => void,
	signal?: AbortSignal,
): Promise<void> {
	await mkdirFor(asset.destination);
	const partial = `${asset.destination}.partial`;
	const response = await fetch(asset.url, signal ? { signal } : {});
	if (!response.ok || !response.body)
		throw new Error(`Download failed (${response.status}): ${asset.url}`);

	const reader = response.body.getReader();
	const file = await open(partial, "w");
	const digest = createHash("sha256");
	let receivedBytes = 0;
	try {
		while (true) {
			const next = await reader.read();
			if (next.done) break;
			const chunk = Buffer.from(next.value);
			receivedBytes += chunk.byteLength;
			if (receivedBytes > asset.sizeBytes)
				throw new Error("Downloaded asset exceeded its manifest size.");
			digest.update(chunk);
			await file.write(chunk);
			onProgress?.({
				receivedBytes,
				...(response.headers.get("content-length")
					? { totalBytes: Number(response.headers.get("content-length")) }
					: {}),
			});
		}
		await file.sync();
		const actualDigest = digest.digest("hex");
		if (
			receivedBytes !== asset.sizeBytes ||
			actualDigest !== asset.sha256.toLowerCase()
		)
			throw new Error(`Checksum verification failed for ${asset.url}.`);
		await rename(partial, asset.destination);
	} catch (error) {
		await rm(partial, { force: true });
		throw error;
	} finally {
		await file.close();
		reader.releaseLock();
	}
}

export async function withFileLock<T>(
	lockPath: string,
	operation: () => Promise<T>,
	timeoutMs = 30_000,
): Promise<T> {
	await mkdirFor(lockPath);
	const deadline = Date.now() + timeoutMs;
	while (true) {
		try {
			const lock = await open(lockPath, "wx");
			await lock.writeFile(
				JSON.stringify({ pid: process.pid, createdAt: Date.now() }),
			);
			await lock.close();
			break;
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
			try {
				const info = await stat(lockPath);
				if (Date.now() - info.mtimeMs > 10 * 60_000) await unlink(lockPath);
			} catch {
				// The owner may have released the lock between stat and unlink.
			}
			if (Date.now() >= deadline)
				throw new Error("Timed out waiting for the Talk-to-Pi asset lock.");
			await new Promise((resolve) => setTimeout(resolve, 100));
		}
	}

	try {
		return await operation();
	} finally {
		await rm(lockPath, { force: true });
	}
}

async function mkdirFor(path: string): Promise<void> {
	await import("node:fs/promises").then(({ mkdir }) =>
		mkdir(dirname(path), { recursive: true }),
	);
}

export async function writeInstallSentinel(
	path: string,
	asset: VerifiedAsset,
): Promise<void> {
	await writeFile(
		`${path}.installed.json`,
		`${JSON.stringify(asset, null, 2)}\n`,
		{ mode: 0o600 },
	);
}
