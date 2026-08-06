import { describe, expect, it } from "vitest";
import {
	runtimeExecutableName,
	runtimePlatformKey,
	UnsupportedPlatformError,
} from "../../src/config/platform.js";

describe("runtime platforms", () => {
	it.each([
		["linux", "x64", "linux-x64-cpu"],
		["linux", "arm64", "linux-arm64-cpu"],
		["darwin", "x64", "darwin-x64-cpu"],
		["darwin", "arm64", "darwin-arm64-cpu"],
		["win32", "x64", "win32-x64-cpu"],
	] as const)("maps %s-%s to its release artifact", (platform, arch, key) => {
		expect(runtimePlatformKey(platform, arch)).toBe(key);
	});

	it("rejects targets without a published runtime", () => {
		expect(() => runtimePlatformKey("win32", "arm64")).toThrowError(
			UnsupportedPlatformError,
		);
	});

	it("uses the Windows executable suffix only on Windows", () => {
		expect(runtimeExecutableName("win32")).toBe("talk-to-pi-runtime.exe");
		expect(runtimeExecutableName("darwin")).toBe("talk-to-pi-runtime");
	});
});
