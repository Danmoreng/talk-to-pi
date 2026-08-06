import { describe, expect, it } from "vitest";
import { getTalkPaths } from "../../src/config/paths.js";

describe("managed paths", () => {
	it("uses the pinned Hugging Face snapshot path by default", () => {
		const paths = getTalkPaths({
			HF_HOME: "/tmp/huggingface",
		});
		expect(paths.modelPath).toBe(
			"/tmp/huggingface/hub/models--nvidia--nemotron-3.5-asr-streaming-0.6b/snapshots/1c8deaecc64b91f034d73e08dd8b64625eb3395d/nemotron-3.5-asr-streaming-0.6b.q8_0.gguf",
		);
	});

	it("honors explicit development overrides", () => {
		const paths = getTalkPaths({
			TALK_TO_PI_CONFIG_DIR: "/tmp/talk-config",
			TALK_TO_PI_DATA_DIR: "/tmp/talk-data",
			TALK_TO_PI_CACHE_DIR: "/tmp/talk-cache",
			TALK_TO_PI_RUNTIME_PATH: "/tmp/runtime",
			TALK_TO_PI_MODEL_PATH: "/tmp/model.gguf",
		});
		expect(paths.configPath).toBe("/tmp/talk-config/config.json");
		expect(paths.dataDir).toBe("/tmp/talk-data");
		expect(paths.cacheDir).toBe("/tmp/talk-cache");
		expect(paths.runtimePath).toBe("/tmp/runtime");
		expect(paths.modelPath).toBe("/tmp/model.gguf");
	});
});
