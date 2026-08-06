import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { dirname } from "node:path";
import type { KeyId } from "@earendil-works/pi-tui";
import { resolveLanguage, type LanguageSetting } from "./language.js";
import { getTalkPaths } from "./paths.js";

export interface TalkConfig {
	shortcut: KeyId | null;
	language: LanguageSetting;
	prewarm: boolean;
}

export interface LoadedTalkConfig {
	config: TalkConfig;
	path: string;
	error?: string;
}

export const DEFAULT_TALK_CONFIG: TalkConfig = {
	shortcut: "alt+r",
	language: "auto",
	prewarm: false,
};

const NAMED_KEYS = new Set([
	"escape",
	"esc",
	"enter",
	"return",
	"tab",
	"space",
	"backspace",
	"delete",
	"insert",
	"clear",
	"home",
	"end",
	"pageup",
	"pagedown",
	"up",
	"down",
	"left",
	"right",
]);

export class TalkConfigError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "TalkConfigError";
	}
}

export function parseTalkConfig(value: unknown): TalkConfig {
	if (typeof value !== "object" || value === null || Array.isArray(value))
		throw new TalkConfigError("Talk-to-Pi config must be a JSON object.");
	const input = value as Record<string, unknown>;
	const known = new Set(["shortcut", "language", "prewarm"]);
	const unknown = Object.keys(input).filter((key) => !known.has(key));
	if (unknown.length > 0)
		throw new TalkConfigError(`Unknown Talk-to-Pi config key: ${unknown[0]}`);

	const shortcut =
		input.shortcut === undefined
			? DEFAULT_TALK_CONFIG.shortcut
			: parseShortcut(input.shortcut);
	const language =
		input.language === undefined
			? DEFAULT_TALK_CONFIG.language
			: parseLanguage(input.language);
	const prewarm =
		input.prewarm === undefined
			? DEFAULT_TALK_CONFIG.prewarm
			: parseBoolean(input.prewarm, "prewarm");

	return { shortcut, language, prewarm };
}

export function loadTalkConfigSync(
	path = getTalkPaths().configPath,
): LoadedTalkConfig {
	try {
		const text = readFileSync(path, "utf8");
		return { config: parseTalkConfig(JSON.parse(text) as unknown), path };
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT")
			return { config: { ...DEFAULT_TALK_CONFIG }, path };
		return {
			config: { ...DEFAULT_TALK_CONFIG },
			path,
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

export async function readTalkConfigText(path: string): Promise<string> {
	try {
		return await readFile(path, "utf8");
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
		return `${JSON.stringify(DEFAULT_TALK_CONFIG, null, 2)}\n`;
	}
}

export async function writeTalkConfig(
	path: string,
	text: string,
): Promise<void> {
	const config = parseTalkConfig(JSON.parse(text) as unknown);
	await mkdir(dirname(path), { recursive: true });
	await writeFile(path, `${JSON.stringify(config, null, 2)}\n`, {
		encoding: "utf8",
		mode: 0o600,
	});
	await chmod(path, 0o600);
}

function parseShortcut(value: unknown): KeyId | null {
	if (value === null) return null;
	if (typeof value !== "string" || !isShortcut(value))
		throw new TalkConfigError(
			"shortcut must be null, a function key, or a key with ctrl/alt/shift modifiers (for example alt+r).",
		);
	return value.toLowerCase() as KeyId;
}

function isShortcut(value: string): boolean {
	const normalized = value.trim().toLowerCase();
	if (!normalized || normalized !== value.toLowerCase()) return false;
	const parts = normalized.split("+");
	const key = parts.pop();
	if (!key) return false;
	const modifiers = parts;
	if (
		new Set(modifiers).size !== modifiers.length ||
		modifiers.some((modifier) => !["ctrl", "alt", "shift"].includes(modifier))
	)
		return false;
	const isFunctionKey = /^f(?:[1-9]|1[0-2])$/.test(key);
	const isBaseKey = /^[a-z0-9]$/.test(key) || NAMED_KEYS.has(key);
	return (
		(isFunctionKey || isBaseKey) && (isFunctionKey || modifiers.length > 0)
	);
}

function parseLanguage(value: unknown): LanguageSetting {
	if (typeof value !== "string" || value.trim() !== value || !value)
		throw new TalkConfigError(
			"language must be auto, system, or a supported locale.",
		);
	try {
		resolveLanguage(value);
	} catch (error) {
		throw new TalkConfigError(
			error instanceof Error ? error.message : String(error),
		);
	}
	return value;
}

function parseBoolean(value: unknown, key: string): boolean {
	if (typeof value !== "boolean")
		throw new TalkConfigError(`${key} must be true or false.`);
	return value;
}
