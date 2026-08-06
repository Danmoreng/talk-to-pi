import { describe, expect, it } from "vitest";
import { appendTranscript } from "../../src/command/talk-command.js";

describe("transcript handoff", () => {
	it("uses the transcript when the editor is empty", () => {
		expect(appendTranscript("", "  hello world  ")).toBe("hello world");
	});

	it("appends with a separating space", () => {
		expect(appendTranscript("Existing draft", "new dictation")).toBe(
			"Existing draft new dictation",
		);
	});

	it("preserves existing trailing whitespace", () => {
		expect(appendTranscript("Existing draft\n", "new dictation")).toBe(
			"Existing draft\nnew dictation",
		);
	});
});
