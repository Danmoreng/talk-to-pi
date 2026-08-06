import { describe, expect, it } from "vitest";
import { Provisioner } from "../../src/provisioning/provisioner.js";

interface ArchiveFilter {
	allowArchiveEntry(path: string, entry: unknown, executable: string): boolean;
}

function filter(): ArchiveFilter {
	return new Provisioner({} as never) as unknown as ArchiveFilter;
}

describe("runtime archive filtering", () => {
	it("accepts the executable, packaged libraries, and licenses", () => {
		const allow = filter();
		expect(
			allow.allowArchiveEntry(
				"talk-to-pi-runtime",
				{ type: "File" },
				"talk-to-pi-runtime",
			),
		).toBe(true);
		expect(
			allow.allowArchiveEntry("lib/", { type: "Directory" }, "runtime"),
		).toBe(true);
		expect(
			allow.allowArchiveEntry("lib/runtime.so", { type: "File" }, "runtime"),
		).toBe(true);
		expect(
			allow.allowArchiveEntry(
				"licenses/project/LICENSE",
				{ type: "File" },
				"runtime",
			),
		).toBe(true);
	});

	it("rejects links, traversal, and unexpected files", () => {
		const allow = filter();
		expect(() =>
			allow.allowArchiveEntry(
				"lib/runtime.so",
				{ type: "SymbolicLink" },
				"runtime",
			),
		).toThrow(/entry type/);
		expect(() =>
			allow.allowArchiveEntry("../runtime", { type: "File" }, "runtime"),
		).toThrow(/path/);
		expect(() =>
			allow.allowArchiveEntry("README", { type: "File" }, "runtime"),
		).toThrow(/Unexpected/);
	});
});
