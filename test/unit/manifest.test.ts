import { describe, expect, it } from "vitest";
import {
	ManifestError,
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
