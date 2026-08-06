import { homedir } from "node:os";
import { join, resolve } from "node:path";

export const MODEL_REPOSITORY = "nvidia/nemotron-3.5-asr-streaming-0.6b";
export const MODEL_REVISION = "1c8deaecc64b91f034d73e08dd8b64625eb3395d";
export const MODEL_FILENAME = "nemotron-3.5-asr-streaming-0.6b.q8_0.gguf";
export const MODEL_SHA256 =
	"a5c435f294eea8f88ce68dd27b8c3bfea7f777cb2fbba04fcd30eaa555f429ae";
export const MODEL_SIZE_BYTES = 741_548_352;

export function huggingFaceModelPath(
	env: NodeJS.ProcessEnv = process.env,
): string {
	const hfHome =
		env.HF_HOME ||
		join(env.XDG_CACHE_HOME || join(homedir(), ".cache"), "huggingface");
	const cacheRoot =
		env.HUGGINGFACE_HUB_CACHE || env.HF_HUB_CACHE || join(hfHome, "hub");
	return resolve(
		join(
			cacheRoot,
			"models--nvidia--nemotron-3.5-asr-streaming-0.6b",
			"snapshots",
			MODEL_REVISION,
			MODEL_FILENAME,
		),
	);
}

export function huggingFaceModelUrl(): string {
	return `https://huggingface.co/${MODEL_REPOSITORY}/resolve/${MODEL_REVISION}/${MODEL_FILENAME}?download=true`;
}
