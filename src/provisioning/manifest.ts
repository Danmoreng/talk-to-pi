import { readFile } from "node:fs/promises";

export interface RuntimeArtifact {
	url: string;
	sha256: string;
	sizeBytes: number;
	archiveType: "tar.gz";
	executable: string;
}

export interface RuntimeManifest {
	schemaVersion: 1;
	runtimeVersion: string;
	protocolVersion: 1;
	artifacts: Record<string, RuntimeArtifact>;
}

export interface ModelManifest {
	schemaVersion: 1;
	modelId: string;
	engine: "nemo-speech.cpp";
	engineCompatibility: { minimumAbi: number; maximumTestedAbi: number };
	source: { repository: string; revision: string; filename: string };
	url: string;
	sha256: string;
	sizeBytes: number;
	license: string;
	attribution: string;
}

export class ManifestError extends Error {
	readonly code = "ASSET_MANIFEST_INVALID" as const;
}

function record(value: unknown, label: string): Record<string, unknown> {
	if (typeof value !== "object" || value === null || Array.isArray(value))
		throw new ManifestError(`${label} must be an object.`);
	return value as Record<string, unknown>;
}

function string(value: unknown, label: string): string {
	if (typeof value !== "string" || value.length === 0)
		throw new ManifestError(`${label} must be a non-empty string.`);
	return value;
}

function positiveInteger(value: unknown, label: string): number {
	if (!Number.isSafeInteger(value) || Number(value) <= 0)
		throw new ManifestError(`${label} must be a positive integer.`);
	return Number(value);
}

function sha256(value: unknown, label: string): string {
	const result = string(value, label).toLowerCase();
	if (!/^[a-f0-9]{64}$/.test(result))
		throw new ManifestError(`${label} must be a SHA-256 hex digest.`);
	return result;
}

function safeRelativePath(value: unknown, label: string): string {
	const result = string(value, label).replaceAll("\\", "/");
	if (
		result.startsWith("/") ||
		result
			.split("/")
			.some((part) => part === "" || part === "." || part === "..")
	)
		throw new ManifestError(`${label} must be a safe relative path.`);
	return result;
}

function httpsUrl(value: unknown, label: string): string {
	const result = string(value, label);
	let url: URL;
	try {
		url = new URL(result);
	} catch {
		throw new ManifestError(`${label} must be a valid URL.`);
	}
	if (url.protocol !== "https:")
		throw new ManifestError(`${label} must use HTTPS.`);
	return result;
}

export function validateRuntimeManifest(value: unknown): RuntimeManifest {
	const object = record(value, "Runtime manifest");
	if (object.schemaVersion !== 1 || object.protocolVersion !== 1)
		throw new ManifestError("Unsupported runtime manifest version.");
	const artifacts = record(object.artifacts, "Runtime artifacts");
	const normalized: Record<string, RuntimeArtifact> = {};
	for (const [platform, raw] of Object.entries(artifacts)) {
		const artifact = record(raw, `Runtime artifact ${platform}`);
		normalized[platform] = {
			url: httpsUrl(artifact.url, `${platform}.url`),
			sha256: sha256(artifact.sha256, `${platform}.sha256`),
			sizeBytes: positiveInteger(artifact.sizeBytes, `${platform}.sizeBytes`),
			archiveType:
				artifact.archiveType === "tar.gz"
					? "tar.gz"
					: (() => {
							throw new ManifestError(
								`${platform}.archiveType must be tar.gz.`,
							);
						})(),
			executable: safeRelativePath(
				artifact.executable,
				`${platform}.executable`,
			),
		};
	}
	return {
		schemaVersion: 1,
		runtimeVersion: string(object.runtimeVersion, "runtimeVersion"),
		protocolVersion: 1,
		artifacts: normalized,
	};
}

export function validateModelManifest(value: unknown): ModelManifest {
	const object = record(value, "Model manifest");
	if (object.schemaVersion !== 1)
		throw new ManifestError("Unsupported model manifest version.");
	const compatibility = record(
		object.engineCompatibility,
		"engineCompatibility",
	);
	const source = record(object.source, "source");
	const result: ModelManifest = {
		schemaVersion: 1,
		modelId: string(object.modelId, "modelId"),
		engine:
			object.engine === "nemo-speech.cpp"
				? "nemo-speech.cpp"
				: (() => {
						throw new ManifestError(
							"Only nemo-speech.cpp models are supported.",
						);
					})(),
		engineCompatibility: {
			minimumAbi: positiveInteger(
				compatibility.minimumAbi,
				"engineCompatibility.minimumAbi",
			),
			maximumTestedAbi: positiveInteger(
				compatibility.maximumTestedAbi,
				"engineCompatibility.maximumTestedAbi",
			),
		},
		source: {
			repository: httpsUrl(source.repository, "source.repository"),
			revision: string(source.revision, "source.revision"),
			filename: string(source.filename, "source.filename"),
		},
		url: httpsUrl(object.url, "url"),
		sha256: sha256(object.sha256, "sha256"),
		sizeBytes: positiveInteger(object.sizeBytes, "sizeBytes"),
		license: string(object.license, "license"),
		attribution: string(object.attribution, "attribution"),
	};
	return result;
}

export async function readRuntimeManifest(
	url = new URL("../../manifests/runtime-v1.json", import.meta.url),
): Promise<RuntimeManifest> {
	return validateRuntimeManifest(
		JSON.parse(await readFile(url, "utf8")) as unknown,
	);
}

export async function readModelManifest(
	url = new URL("../../manifests/model-v1.json", import.meta.url),
): Promise<ModelManifest> {
	return validateModelManifest(
		JSON.parse(await readFile(url, "utf8")) as unknown,
	);
}
