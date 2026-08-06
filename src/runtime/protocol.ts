import { Buffer } from "node:buffer";

export const PROTOCOL_VERSION = 1 as const;
export const MAX_PROTOCOL_LINE_BYTES = 1024 * 1024;

export interface ProtocolEnvelope {
	v: typeof PROTOCOL_VERSION;
	type: string;
	id?: string;
	sessionId?: string;
	seq?: number;
	[key: string]: unknown;
}

export type RuntimeCommandInput =
	| { type: "ping"; id?: string }
	| { type: "start"; id?: string; sessionId: string; language: string }
	| { type: "stop"; id?: string; sessionId: string }
	| { type: "cancel"; id?: string; sessionId: string }
	| { type: "shutdown"; id?: string };

export type RuntimeCommand = RuntimeCommandInput & {
	v: typeof PROTOCOL_VERSION;
	id: string;
};

export type RuntimeMessage = ProtocolEnvelope;

export interface ProtocolErrorDetails {
	code: string;
	message: string;
	recoverable: boolean;
}

export class ProtocolError extends Error {
	readonly code: string;
	readonly line?: string;

	constructor(code: string, message: string, line?: string) {
		super(message);
		this.name = "ProtocolError";
		this.code = code;
		if (line !== undefined) this.line = line;
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseProtocolLine(line: string): RuntimeMessage {
	const trimmed = line.endsWith("\r") ? line.slice(0, -1) : line;
	if (Buffer.byteLength(trimmed, "utf8") > MAX_PROTOCOL_LINE_BYTES) {
		throw new ProtocolError(
			"LINE_TOO_LARGE",
			"Protocol line exceeds the 1 MiB limit.",
			trimmed.slice(0, 256),
		);
	}

	let value: unknown;
	try {
		value = JSON.parse(trimmed) as unknown;
	} catch {
		throw new ProtocolError(
			"MALFORMED_JSON",
			"Runtime emitted malformed JSON.",
			trimmed.slice(0, 256),
		);
	}
	if (!isRecord(value))
		throw new ProtocolError(
			"INVALID_MESSAGE",
			"Protocol message must be a JSON object.",
		);
	if (value.v !== PROTOCOL_VERSION) {
		throw new ProtocolError(
			"PROTOCOL_MISMATCH",
			`Unsupported protocol version: ${String(value.v)}`,
		);
	}
	if (typeof value.type !== "string" || value.type.length === 0) {
		throw new ProtocolError(
			"INVALID_MESSAGE",
			"Protocol message must contain a non-empty type.",
		);
	}
	if (value.id !== undefined && typeof value.id !== "string") {
		throw new ProtocolError(
			"INVALID_MESSAGE",
			"Protocol message id must be a string.",
		);
	}
	if (value.sessionId !== undefined && typeof value.sessionId !== "string") {
		throw new ProtocolError(
			"INVALID_MESSAGE",
			"Protocol sessionId must be a string.",
		);
	}
	if (
		value.seq !== undefined &&
		(typeof value.seq !== "number" ||
			!Number.isSafeInteger(value.seq) ||
			value.seq < 1)
	) {
		throw new ProtocolError(
			"INVALID_MESSAGE",
			"Protocol seq must be a positive safe integer.",
		);
	}
	return value as RuntimeMessage;
}

export function encodeProtocolMessage(message: ProtocolEnvelope): string {
	if (message.v !== PROTOCOL_VERSION)
		throw new ProtocolError(
			"PROTOCOL_MISMATCH",
			"Cannot encode an unsupported protocol version.",
		);
	const line = JSON.stringify(message);
	if (Buffer.byteLength(line, "utf8") > MAX_PROTOCOL_LINE_BYTES) {
		throw new ProtocolError(
			"LINE_TOO_LARGE",
			"Protocol message exceeds the 1 MiB limit.",
		);
	}
	return `${line}\n`;
}

export class JsonlDecoder {
	private remainder = "";

	feed(chunk: string | Uint8Array): RuntimeMessage[] {
		this.remainder +=
			typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8");
		const messages: RuntimeMessage[] = [];
		let newlineIndex = this.remainder.indexOf("\n");

		while (newlineIndex >= 0) {
			const line = this.remainder.slice(0, newlineIndex);
			this.remainder = this.remainder.slice(newlineIndex + 1);
			messages.push(parseProtocolLine(line));
			newlineIndex = this.remainder.indexOf("\n");
		}

		if (Buffer.byteLength(this.remainder, "utf8") > MAX_PROTOCOL_LINE_BYTES) {
			throw new ProtocolError(
				"LINE_TOO_LARGE",
				"Incomplete protocol line exceeds the 1 MiB limit.",
			);
		}
		return messages;
	}

	finish(): void {
		if (this.remainder.length > 0)
			throw new ProtocolError(
				"TRUNCATED_MESSAGE",
				"Runtime closed with an incomplete JSONL message.",
			);
	}
}

export function isRuntimeEvent(message: RuntimeMessage, type: string): boolean {
	return message.type === type && typeof message.seq === "number";
}

export function isTerminalRecordingEvent(message: RuntimeMessage): boolean {
	return ["recording_finalized", "recording_cancelled"].includes(message.type);
}
