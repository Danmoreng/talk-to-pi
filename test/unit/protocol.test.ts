import { describe, expect, it } from "vitest";
import {
	JsonlDecoder,
	MAX_PROTOCOL_LINE_BYTES,
	ProtocolError,
	encodeProtocolMessage,
	parseProtocolLine,
} from "../../src/runtime/protocol.js";

describe("JSONL protocol", () => {
	it("parses valid messages and preserves Unicode", () => {
		expect(
			parseProtocolLine(
				'{"v":1,"type":"transcript_delta","seq":1,"text":"Grüße 👋"}',
			),
		).toMatchObject({
			type: "transcript_delta",
			text: "Grüße 👋",
		});
	});

	it("decodes messages split across chunks", () => {
		const decoder = new JsonlDecoder();
		expect(
			decoder.feed('{"v":1,"type":"pong","seq":1}\n{"v":1,"type":"ready"}'),
		).toHaveLength(1);
		expect(decoder.feed("\n")).toEqual([{ v: 1, type: "ready" }]);
		decoder.finish();
	});

	it("rejects malformed and oversized messages", () => {
		expect(() => parseProtocolLine("not json")).toThrowError(ProtocolError);
		expect(() =>
			parseProtocolLine(JSON.stringify({ v: 2, type: "ping" })),
		).toThrow(/Unsupported protocol/);
		expect(() =>
			parseProtocolLine(
				`{"v":1,"type":"x","text":"${"x".repeat(MAX_PROTOCOL_LINE_BYTES)}"}`,
			),
		).toThrow(/1 MiB/);
	});

	it("encodes exactly one newline", () => {
		expect(encodeProtocolMessage({ v: 1, type: "pong", seq: 1 })).toBe(
			'{"v":1,"type":"pong","seq":1}\n',
		);
	});
});
