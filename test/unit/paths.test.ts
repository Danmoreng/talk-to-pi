import { describe, expect, it } from "vitest";
import { getTalkPaths } from "../../src/config/paths.js";

describe("managed paths", () => {
	it("honors explicit development overrides", () => {
		const paths = getTalkPaths({
			TALK_TO_PI_DATA_DIR: "/tmp/talk-data",
			TALK_TO_PI_CACHE_DIR: "/tmp/talk-cache",
			TALK_TO_PI_RUNTIME_PATH: "/tmp/runtime",
			TALK_TO_PI_MODEL_PATH: "/tmp/model.gguf",
		});
		expect(paths.dataDir).toBe("/tmp/talk-data");
		expect(paths.cacheDir).toBe("/tmp/talk-cache");
		expect(paths.runtimePath).toBe("/tmp/runtime");
		expect(paths.modelPath).toBe("/tmp/model.gguf");
	});
});
