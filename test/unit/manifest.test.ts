import { describe, expect, it } from "vitest";
import {
	ManifestError,
	validateModelManifest,
	validateRuntimeManifest,
} from "../../src/provisioning/manifest.js";

describe("asset manifests", () => {
	it("validates immutable runtime artifacts", () => {
		const manifest = validateRuntimeManifest({
			schemaVersion: 1,
			runtimeVersion: "0.1.0",
			protocolVersion: 1,
			artifacts: {
				"linux-x64-cpu": {
					url: "https://example.com/runtime.tar.gz",
					sha256: "a".repeat(64),
					sizeBytes: 42,
					archiveType: "tar.gz",
					executable: "talk-to-pi-runtime",
				},
			},
		});
		expect(manifest.artifacts["linux-x64-cpu"]?.sha256).toBe("a".repeat(64));
	});

	it("accepts the official NeMo model manifest shape", () => {
		const manifest = validateModelManifest({
			schemaVersion: 1,
			modelId: "nemotron",
			engine: "nemo-speech.cpp",
			engineCompatibility: { minimumAbi: 1, maximumTestedAbi: 1 },
			source: {
				repository: "https://huggingface.co/nvidia/nemotron",
				revision: "a".repeat(40),
				filename: "model.gguf",
			},
			url: "https://huggingface.co/nvidia/nemotron/resolve/a/model.gguf",
			sha256: "b".repeat(64),
			sizeBytes: 42,
			license: "OpenMDW-1.1",
			attribution: "NVIDIA",
		});
		expect(manifest.engine).toBe("nemo-speech.cpp");
	});

	it("rejects non-HTTPS and placeholder artifacts", () => {
		expect(() =>
			validateRuntimeManifest({
				schemaVersion: 1,
				runtimeVersion: "0.1.0",
				protocolVersion: 1,
				artifacts: {
					linux: {
						url: "http://example.com/runtime.tar.gz",
						sha256: "a".repeat(64),
						sizeBytes: 1,
						archiveType: "tar.gz",
						executable: "runtime",
					},
				},
			}),
		).toThrowError(ManifestError);
	});
});
