import { describe, expect, it } from "vitest";
import { initialTalkState, reduceTalkState } from "../../src/session/state.js";

describe("talk session reducer", () => {
	it("accumulates only deltas for the active session", () => {
		let state = reduceTalkState(initialTalkState, {
			type: "recording_started",
			sessionId: "s1",
		});
		state = reduceTalkState(state, {
			type: "transcript_delta",
			sessionId: "s1",
			text: "Hallo",
		});
		state = reduceTalkState(state, {
			type: "transcript_delta",
			sessionId: "old",
			text: " falsch",
		});
		expect(state.transcript).toBe("Hallo");
	});

	it("uses final text as authoritative", () => {
		let state = reduceTalkState(initialTalkState, {
			type: "recording_started",
			sessionId: "s1",
		});
		state = reduceTalkState(state, {
			type: "transcript_delta",
			sessionId: "s1",
			text: "partial",
		});
		state = reduceTalkState(state, {
			type: "recording_finalized",
			sessionId: "s1",
			text: "final text",
		});
		expect(state).toMatchObject({ phase: "closed", transcript: "final text" });
	});
});
