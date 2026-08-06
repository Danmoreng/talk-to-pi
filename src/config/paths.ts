import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { huggingFaceModelPath } from "./model.js";

export const PACKAGE_VERSION = "0.1.0";
export const RUNTIME_VERSION = "0.1.0";

export interface TalkPaths {
	configDir: string;
	dataDir: string;
	cacheDir: string;
	modelPath: string;
	runtimeDir: string;
	runtimePath: string;
	downloadsDir: string;
	locksDir: string;
	logsDir: string;
}

function xdgPath(variable: string, fallback: string): string {
	return resolve(process.env[variable] || fallback);
}

export function getTalkPaths(env: NodeJS.ProcessEnv = process.env): TalkPaths {
	const configBase =
		env.TALK_TO_PI_CONFIG_DIR ||
		xdgPath("XDG_CONFIG_HOME", join(homedir(), ".config"));
	const dataBase =
		env.TALK_TO_PI_DATA_DIR ||
		xdgPath("XDG_DATA_HOME", join(homedir(), ".local", "share"));
	const cacheBase =
		env.TALK_TO_PI_CACHE_DIR ||
		xdgPath("XDG_CACHE_HOME", join(homedir(), ".cache"));

	const configDir = resolve(
		env.TALK_TO_PI_CONFIG_DIR || join(configBase, "talk-to-pi"),
	);
	const dataDir = resolve(
		env.TALK_TO_PI_DATA_DIR || join(dataBase, "talk-to-pi"),
	);
	const cacheDir = resolve(
		env.TALK_TO_PI_CACHE_DIR || join(cacheBase, "talk-to-pi"),
	);
	const runtimeDir = join(cacheDir, "runtime", RUNTIME_VERSION);

	return {
		configDir,
		dataDir,
		cacheDir,
		modelPath: env.TALK_TO_PI_MODEL_PATH || huggingFaceModelPath(env),
		runtimeDir,
		runtimePath:
			env.TALK_TO_PI_RUNTIME_PATH || join(runtimeDir, "talk-to-pi-runtime"),
		downloadsDir: join(cacheDir, "downloads"),
		locksDir: join(cacheDir, "locks"),
		logsDir: join(cacheDir, "logs"),
	};
}

export async function ensureTalkDirectories(paths: TalkPaths): Promise<void> {
	const { mkdir } = await import("node:fs/promises");
	await Promise.all([
		mkdir(paths.configDir, { recursive: true }),
		mkdir(paths.dataDir, { recursive: true }),
		mkdir(paths.cacheDir, { recursive: true }),
		mkdir(paths.runtimeDir, { recursive: true }),
		mkdir(paths.downloadsDir, { recursive: true }),
		mkdir(paths.locksDir, { recursive: true }),
		mkdir(paths.logsDir, { recursive: true }),
		mkdir(join(paths.dataDir, "models"), { recursive: true }),
		mkdir(dirname(paths.modelPath), { recursive: true }),
		mkdir(join(paths.dataDir, "licenses"), { recursive: true }),
	]);
}
