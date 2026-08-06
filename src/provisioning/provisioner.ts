import {
	access,
	chmod,
	constants,
	mkdir,
	rename,
	rm,
	stat,
} from "node:fs/promises";
import { join } from "node:path";
import * as tar from "tar";
import {
	getTalkPaths,
	ensureTalkDirectories,
	type TalkPaths,
} from "../config/paths.js";
import {
	downloadVerified,
	verifyFile,
	withFileLock,
	writeInstallSentinel,
	type DownloadProgress,
} from "./download.js";
import {
	readModelManifest,
	readRuntimeManifest,
	type ModelManifest,
	type RuntimeArtifact,
} from "./manifest.js";

export type ProvisionAsset = "runtime" | "model";

export interface ProvisionerProgress {
	asset: ProvisionAsset;
	receivedBytes: number;
	totalBytes?: number;
}

export class Provisioner {
	constructor(private readonly paths: TalkPaths = getTalkPaths()) {}

	async ensure(
		onProgress?: (progress: ProvisionerProgress) => void,
		signal?: AbortSignal,
	): Promise<void> {
		await ensureTalkDirectories(this.paths);
		const platform = this.platformKey();
		const [runtimeManifest, modelManifest] = await Promise.all([
			readRuntimeManifest(),
			readModelManifest(),
		]);
		const runtimeArtifact = runtimeManifest.artifacts[platform];
		if (!runtimeArtifact)
			throw new Error(`No runtime artifact is published for ${platform}.`);
		this.validateModelReleaseGate(modelManifest);

		await withFileLock(join(this.paths.locksDir, "assets.lock"), async () => {
			await this.installModel(modelManifest, onProgress, signal);
			await this.installRuntime(runtimeArtifact, onProgress, signal);
		});
	}

	private async installModel(
		manifest: ModelManifest,
		onProgress?: (progress: ProvisionerProgress) => void,
		signal?: AbortSignal,
	): Promise<void> {
		if (
			await verifyFile(
				this.paths.modelPath,
				manifest.sizeBytes,
				manifest.sha256,
			)
		)
			return;
		await downloadVerified(
			{
				url: manifest.url,
				destination: this.paths.modelPath,
				sizeBytes: manifest.sizeBytes,
				sha256: manifest.sha256,
			},
			(progress) => onProgress?.({ asset: "model", ...progress }),
			signal,
		);
	}

	private async installRuntime(
		artifact: RuntimeArtifact,
		onProgress?: (progress: ProvisionerProgress) => void,
		signal?: AbortSignal,
	): Promise<void> {
		const archivePath = join(
			this.paths.downloadsDir,
			`runtime-${this.platformKey()}.tar.gz`,
		);
		const executablePath = join(this.paths.runtimeDir, artifact.executable);
		if (await this.isInstalledRuntime(executablePath)) return;

		await downloadVerified(
			{
				url: artifact.url,
				destination: archivePath,
				sizeBytes: artifact.sizeBytes,
				sha256: artifact.sha256,
			},
			(progress) => onProgress?.({ asset: "runtime", ...progress }),
			signal,
		);
		const extractionDir = `${this.paths.runtimeDir}.partial-${process.pid}`;
		await rm(extractionDir, { recursive: true, force: true });
		await mkdir(extractionDir, { recursive: true });
		try {
			await tar.extract({
				file: archivePath,
				cwd: extractionDir,
				strict: true,
				preservePaths: false,
				filter: (path, entry) =>
					this.allowArchiveEntry(path, entry, artifact.executable),
			});
			const extracted = join(extractionDir, artifact.executable);
			await chmod(extracted, 0o755);
			await rm(this.paths.runtimeDir, { recursive: true, force: true });
			await rename(extractionDir, this.paths.runtimeDir);
			await writeInstallSentinel(executablePath, {
				url: artifact.url,
				destination: executablePath,
				sizeBytes: artifact.sizeBytes,
				sha256: artifact.sha256,
			});
		} catch (error) {
			await rm(extractionDir, { recursive: true, force: true });
			throw error;
		}
	}

	private allowArchiveEntry(
		path: string,
		entry: unknown,
		executable: string,
	): boolean {
		const normalized = path.replaceAll("\\", "/");
		const entryType =
			typeof entry === "object" &&
			entry !== null &&
			"type" in entry &&
			typeof entry.type === "string"
				? entry.type
				: undefined;
		if (normalized.startsWith("/") || normalized.split("/").includes(".."))
			throw new Error(`Unsafe runtime archive path: ${path}`);
		if (
			entryType === "SymbolicLink" ||
			entryType === "Link" ||
			entryType === "BlockDevice" ||
			entryType === "CharacterDevice"
		) {
			throw new Error(`Unsafe runtime archive entry type: ${path}`);
		}
		if (
			normalized !== executable &&
			!executable.startsWith(`${normalized.replace(/\/$/, "")}/`)
		) {
			throw new Error(`Unexpected runtime archive entry: ${path}`);
		}
		return true;
	}

	private async isInstalledRuntime(executablePath: string): Promise<boolean> {
		try {
			await access(executablePath, constants.X_OK);
			await stat(`${executablePath}.installed.json`);
			return true;
		} catch {
			return false;
		}
	}

	private validateModelReleaseGate(manifest: ModelManifest): void {
		if (
			manifest.source.revision === "RELEASE_GATE_REQUIRED" ||
			manifest.url === "RELEASE_GATE_REQUIRED" ||
			manifest.sha256 === "RELEASE_GATE_REQUIRED" ||
			manifest.sizeBytes <= 0
		) {
			throw new Error(
				"The Nemotron model manifest is not release-ready; provenance, URL, size, and SHA-256 must be finalized first.",
			);
		}
	}

	private platformKey(): string {
		if (process.platform === "linux" && process.arch === "x64")
			return "linux-x64-cpu";
		throw new Error(
			`Talk-to-Pi does not support ${process.platform}-${process.arch} in this release.`,
		);
	}
}
