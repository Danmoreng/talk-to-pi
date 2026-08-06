export type TalkPhase =
	| "idle"
	| "provisioning"
	| "starting_runtime"
	| "recording"
	| "finalizing"
	| "error"
	| "closed";

export interface TalkState {
	phase: TalkPhase;
	sessionId?: string | undefined;
	transcript: string;
	speechEvent?: "eou" | "eob" | undefined;
	warning?: string | undefined;
	error?: string | undefined;
}

export type TalkAction =
	| { type: "provisioning" }
	| { type: "starting_runtime" }
	| { type: "recording_started"; sessionId: string }
	| { type: "transcript_delta"; sessionId: string; text: string }
	| { type: "transcript_update"; sessionId: string; text: string }
	| { type: "speech_event"; sessionId: string; event: "eou" | "eob" }
	| { type: "finalizing" }
	| { type: "recording_finalized"; sessionId: string; text: string }
	| { type: "error"; message: string; recoverable: boolean }
	| { type: "closed" };

export const initialTalkState: TalkState = { phase: "idle", transcript: "" };

export function reduceTalkState(
	state: TalkState,
	action: TalkAction,
): TalkState {
	switch (action.type) {
		case "provisioning":
			return { ...state, phase: "provisioning", error: undefined };
		case "starting_runtime":
			return { ...state, phase: "starting_runtime", error: undefined };
		case "recording_started":
			return {
				phase: "recording",
				sessionId: action.sessionId,
				transcript: "",
			};
		case "transcript_delta":
			if (state.phase !== "recording" || state.sessionId !== action.sessionId)
				return state;
			return { ...state, transcript: state.transcript + action.text };
		case "transcript_update":
			if (state.phase !== "recording" || state.sessionId !== action.sessionId)
				return state;
			return { ...state, transcript: action.text };
		case "speech_event":
			if (state.sessionId !== action.sessionId) return state;
			return { ...state, speechEvent: action.event };
		case "finalizing":
			return { ...state, phase: "finalizing" };
		case "recording_finalized":
			if (state.sessionId !== action.sessionId) return state;
			return { ...state, phase: "closed", transcript: action.text };
		case "error":
			return {
				...state,
				phase: action.recoverable ? "error" : "closed",
				error: action.message,
			};
		case "closed":
			return { ...state, phase: "closed" };
	}
}
