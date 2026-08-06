import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const packageJson = JSON.parse(
	readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
) as {
	scripts?: Record<string, string>;
};

describe("package safety", () => {
	it("has no npm lifecycle scripts", () => {
		expect(packageJson.scripts).not.toHaveProperty("install");
		expect(packageJson.scripts).not.toHaveProperty("postinstall");
		expect(packageJson.scripts).not.toHaveProperty("preinstall");
	});
});
