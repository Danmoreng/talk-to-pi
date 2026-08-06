import { Text } from "@earendil-works/pi-tui";

export function createTranscriptView(
	text: string,
	theme: { fg: (name: string, value: string) => string },
): Text {
	const content = text.length > 0 ? text : theme.fg("dim", "Speak now…");
	return new Text(content, 1, 0);
}
