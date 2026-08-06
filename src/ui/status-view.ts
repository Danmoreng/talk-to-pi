export type TalkStatus =
	"provisioning" | "starting_runtime" | "recording" | "finalizing" | "error";

export function statusText(
	status: TalkStatus,
	speechEvent?: "eou" | "eob",
): string {
	switch (status) {
		case "provisioning":
			return "Preparing local speech runtime…";
		case "starting_runtime":
			return "Starting local speech runtime…";
		case "recording":
			return speechEvent
				? `● Listening · ${speechEvent.toUpperCase()}`
				: "● Listening · local";
		case "finalizing":
			return "Finalizing local transcription…";
		case "error":
			return "Transcription failed; preserving available text";
	}
}
