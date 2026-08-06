import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
	DEFAULT_TALK_CONFIG,
	loadTalkConfigSync,
	parseTalkConfig,
	writeTalkConfig,
} from "../../src/config/config.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
	await Promise.all(
		temporaryDirectories
			.splice(0)
			.map((path) => rm(path, { recursive: true, force: true })),
	);
});

describe("persistent configuration", () => {
	it("uses safe defaults when the file does not exist", () => {
		const loaded = loadTalkConfigSync("/definitely/missing/talk-to-pi.json");
		expect(loaded.config).toEqual(DEFAULT_TALK_CONFIG);
		expect(loaded.error).toBeUndefined();
	});

	it("validates shortcut, language, and prewarm", () => {
		expect(
			parseTalkConfig({ shortcut: "alt+r", language: "de-DE", prewarm: true }),
		).toEqual({ shortcut: "alt+r", language: "de-DE", prewarm: true });
		expect(parseTalkConfig({ shortcut: null }).shortcut).toBeNull();
		expect(() => parseTalkConfig({ shortcut: "r" })).toThrow(/shortcut/);
		expect(() => parseTalkConfig({ language: "xx-YY" })).toThrow(
			/Unsupported language/,
		);
		expect(() => parseTalkConfig({ typo: true })).toThrow(/Unknown/);
	});

	it("writes normalized JSON with private permissions", async () => {
		const directory = await mkdtemp(join(tmpdir(), "talk-to-pi-config-"));
		temporaryDirectories.push(directory);
		const path = join(directory, "nested", "config.json");
		await writeTalkConfig(
			path,
			JSON.stringify({ shortcut: "f8", language: "system", prewarm: false }),
		);
		expect(JSON.parse(await readFile(path, "utf8"))).toEqual({
			shortcut: "f8",
			language: "system",
			prewarm: false,
		});
		expect((await stat(path)).mode & 0o777).toBe(0o600);
	});

	it("falls back and reports malformed JSON", async () => {
		const directory = await mkdtemp(join(tmpdir(), "talk-to-pi-config-"));
		temporaryDirectories.push(directory);
		const path = join(directory, "config.json");
		await writeFile(path, "not json");
		const loaded = loadTalkConfigSync(path);
		expect(loaded.config).toEqual(DEFAULT_TALK_CONFIG);
		expect(loaded.error).toMatch(/JSON/);
	});
});
