export const SUPPORTED_RUNTIME_PLATFORMS = [
	"linux-x64-cpu",
	"linux-arm64-cpu",
	"darwin-x64-cpu",
	"darwin-arm64-cpu",
	"win32-x64-cpu",
] as const;

export type RuntimePlatformKey = (typeof SUPPORTED_RUNTIME_PLATFORMS)[number];

export class UnsupportedPlatformError extends Error {
	readonly code = "PLATFORM_UNSUPPORTED" as const;

	constructor(platform: NodeJS.Platform, arch: string) {
		super(
			`Talk-to-Pi does not support ${platform}-${arch}. Supported targets: ${SUPPORTED_RUNTIME_PLATFORMS.join(", ")}.`,
		);
		this.name = "UnsupportedPlatformError";
	}
}

export function runtimePlatformKey(
	platform: NodeJS.Platform = process.platform,
	arch: string = process.arch,
): RuntimePlatformKey {
	const key = `${platform}-${arch}-cpu`;
	if (SUPPORTED_RUNTIME_PLATFORMS.includes(key as RuntimePlatformKey))
		return key as RuntimePlatformKey;
	throw new UnsupportedPlatformError(platform, arch);
}

export function runtimeExecutableName(
	platform: NodeJS.Platform = process.platform,
): string {
	return platform === "win32" ? "talk-to-pi-runtime.exe" : "talk-to-pi-runtime";
}
