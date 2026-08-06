import { describe, expect, it } from "vitest";
import {
	localeFromEnvironment,
	normalizeLocale,
	resolveLanguage,
} from "../../src/config/language.js";

describe("language resolution", () => {
	it("normalizes common locale forms", () => {
		expect(normalizeLocale("de_DE.UTF-8")).toBe("de-DE");
		expect(normalizeLocale("en_US@euro")).toBe("en-US");
	});

	it("uses the first configured locale source", () => {
		expect(
			localeFromEnvironment({
				LANG: "en_US.UTF-8",
				LC_MESSAGES: "de_DE.UTF-8",
			}),
		).toBe("de-DE");
		expect(resolveLanguage("system", { LANG: "de_DE.UTF-8" })).toBe("de-DE");
		expect(resolveLanguage("system", { LANG: "C" })).toBe("auto");
	});

	it("supports explicit auto and locales", () => {
		expect(resolveLanguage("auto")).toBe("auto");
		expect(resolveLanguage("de-DE")).toBe("de-DE");
		expect(() => resolveLanguage("xx-YY")).toThrow(/Unsupported language/);
	});
});
