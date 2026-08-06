const SUPPORTED_LOCALES = new Set([
	"ar-SA",
	"de-DE",
	"en-US",
	"es-ES",
	"fr-FR",
	"hi-IN",
	"id-ID",
	"it-IT",
	"ja-JP",
	"ko-KR",
	"nl-NL",
	"pl-PL",
	"pt-BR",
	"ru-RU",
	"th-TH",
	"tr-TR",
	"uk-UA",
	"vi-VN",
	"zh-CN",
]);

export type LanguageSetting = "system" | "auto" | string;

export class UnsupportedLanguageError extends Error {
	readonly code = "LANGUAGE_UNSUPPORTED" as const;

	constructor(language: string) {
		super(`Unsupported language locale: ${language}`);
		this.name = "UnsupportedLanguageError";
	}
}

export function normalizeLocale(value: string | undefined): string | undefined {
	if (!value) return undefined;
	const base = value.trim().split(/[.@]/, 1)[0];
	if (!base) return undefined;
	const parts = base.split(/[-_]/);
	if (parts.length === 1) return parts[0]?.toLowerCase();
	const [language, region] = parts;
	if (!language || !region) return undefined;
	return `${language.toLowerCase()}-${region.toUpperCase()}`;
}

export function localeFromEnvironment(
	env: NodeJS.ProcessEnv = process.env,
): string | undefined {
	return normalizeLocale(env.LC_ALL || env.LC_MESSAGES || env.LANG);
}

export function resolveLanguage(
	setting: LanguageSetting = "system",
	env: NodeJS.ProcessEnv = process.env,
): "auto" | string {
	if (setting === "auto") return "auto";
	if (setting !== "system") {
		const locale = normalizeLocale(setting);
		if (!locale || !SUPPORTED_LOCALES.has(locale))
			throw new UnsupportedLanguageError(setting);
		return locale;
	}

	const systemLocale = localeFromEnvironment(env);
	return systemLocale && SUPPORTED_LOCALES.has(systemLocale)
		? systemLocale
		: "auto";
}

export function isSupportedLocale(locale: string): boolean {
	return SUPPORTED_LOCALES.has(locale);
}
