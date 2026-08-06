import { access, stat } from "node:fs/promises";
import { constants } from "node:fs";
import { randomUUID } from "node:crypto";
import { getTalkPaths, type TalkPaths } from "../config/paths.js";
import {
	Provisioner,
	type ProvisionerProgress,
} from "../provisioning/provisioner.js";
import { type RuntimeMessage } from "./protocol.js";
import { RuntimeProcess } from "./runtime-process.js";

export interface ProvisionProgress {
	asset: "runtime" | "model";
	receivedBytes: number;
	totalBytes?: number;
}

export interface RuntimeDiagnostics {
	runtimePath: string;
	modelPath: string;
	runtimeInstalled: boolean;
	modelInstalled: boolean;
	processAlive: boolean;
	stderr: string;
}

export interface RecordingOptions {
	sessionId: string;
	language: string;
	onEvent: (message: RuntimeMessage) => void;
}

export interface TalkRuntime {
	ensureProvisioned(
		onProgress?: (progress: ProvisionProgress) => void,
		signal?: AbortSignal,
	): Promise<void>;
	ensureReady(signal?: AbortSignal): Promise<void>;
	startRecording(options: RecordingOptions): Promise<void>;
	stopRecording(sessionId: string): Promise<void>;
	cancelRecording(sessionId: string): Promise<void>;
	getDiagnostics(): Promise<RuntimeDiagnostics>;
	shutdown(): Promise<void>;
}

export class RuntimeUnavailableError extends Error {
	readonly code = "ASSET_NOT_PROVISIONED" as const;

	constructor(message: string) {
		super(message);
		this.name = "RuntimeUnavailableError";
	}
}

export class RuntimeManager implements TalkRuntime {
	private process: RuntimeProcess | undefined;
	private readonly listeners = new Map<string, Array<() => void>>();

	private readonly provisioner: Provisioner;

	constructor(private readonly paths: TalkPaths = getTalkPaths()) {
		this.provisioner = new Provisioner(paths);
	}

	async ensureProvisioned(
		onProgress?: (progress: ProvisionProgress) => void,
		signal?: AbortSignal,
	): Promise<void> {
		if (signal?.aborted)
			throw new DOMException("The operation was aborted.", "AbortError");
		if (await this.hasExplicitLocalAssets()) return;
		try {
			await this.provisioner.ensure(
				onProgress
					? (progress: ProvisionerProgress) => onProgress(progress)
					: undefined,
				signal,
			);
		} catch (error) {
			if (error instanceof RuntimeUnavailableError) throw error;
			throw new RuntimeUnavailableError(
				error instanceof Error ? error.message : String(error),
			);
		}
		const [runtimeInstalled, modelInstalled] = await Promise.all([
			this.isExecutable(this.paths.runtimePath),
			this.isRegularFile(this.paths.modelPath),
		]);
		if (!runtimeInstalled || !modelInstalled) {
			throw new RuntimeUnavailableError(
				"Talk-to-Pi provisioning completed without installing all required assets.",
			);
		}
	}

	async ensureReady(signal?: AbortSignal): Promise<void> {
		await this.ensureProvisioned(undefined, signal);
		if (signal?.aborted)
			throw new DOMException("The operation was aborted.", "AbortError");
		if (!this.process || !this.process.isAlive) {
			this.process = new RuntimeProcess({
				runtimePath: this.paths.runtimePath,
				modelPath: this.paths.modelPath,
				protocolVersion: 1,
			});
			await this.process.start();
		}
	}

	async startRecording(options: RecordingOptions): Promise<void> {
		await this.ensureReady();
		const process = this.requireProcess();
		this.cleanupSession(options.sessionId);
		const cleanup = () => this.cleanupSession(options.sessionId);
		const offMessage = process.onMessage((message) => {
			if (message.sessionId !== options.sessionId && message.type !== "error")
				return;
			options.onEvent(message);
			if (["recording_finalized", "recording_cancelled"].includes(message.type))
				cleanup();
		});
		const offFailure = process.onFailure((error) => {
			options.onEvent({
				v: 1,
				type: "error",
				sessionId: options.sessionId,
				code: "RUNTIME_CRASHED",
				message: error.message,
				recoverable: true,
			});
			cleanup();
		});
		this.listeners.set(options.sessionId, [offMessage, offFailure]);
		try {
			await process.sendCommand({
				type: "start",
				sessionId: options.sessionId,
				language: options.language,
			});
		} catch (error) {
			cleanup();
			throw error;
		}
	}

	async stopRecording(sessionId: string): Promise<void> {
		await this.requireProcess().sendCommand({ type: "stop", sessionId });
	}

	async cancelRecording(sessionId: string): Promise<void> {
		try {
			await this.requireProcess().sendCommand({ type: "cancel", sessionId });
		} finally {
			this.cleanupSession(sessionId);
		}
	}

	async getDiagnostics(): Promise<RuntimeDiagnostics> {
		const runtimeInstalled = await this.isExecutable(this.paths.runtimePath);
		const modelInstalled = await this.isRegularFile(this.paths.modelPath);
		return {
			runtimePath: this.paths.runtimePath,
			modelPath: this.paths.modelPath,
			runtimeInstalled,
			modelInstalled,
			processAlive: this.process?.isAlive ?? false,
			stderr: this.process?.stderr ?? "",
		};
	}

	async shutdown(): Promise<void> {
		for (const sessionId of this.listeners.keys())
			this.cleanupSession(sessionId);
		await this.process?.shutdown();
		this.process = undefined;
	}

	private cleanupSession(sessionId: string): void {
		for (const off of this.listeners.get(sessionId) ?? []) off();
		this.listeners.delete(sessionId);
	}

	private requireProcess(): RuntimeProcess {
		if (!this.process) throw new Error("Talk-to-Pi runtime is not ready.");
		return this.process;
	}

	private async hasExplicitLocalAssets(): Promise<boolean> {
		const runtimeOverride = process.env.TALK_TO_PI_RUNTIME_PATH;
		const modelOverride = process.env.TALK_TO_PI_MODEL_PATH;
		if (!runtimeOverride && !modelOverride) return false;
		if (!runtimeOverride || !modelOverride) {
			throw new RuntimeUnavailableError(
				"TALK_TO_PI_RUNTIME_PATH and TALK_TO_PI_MODEL_PATH must be set together.",
			);
		}
		const [runtimeInstalled, modelInstalled] = await Promise.all([
			this.isExecutable(runtimeOverride),
			this.isRegularFile(modelOverride),
		]);
		if (!runtimeInstalled || !modelInstalled) {
			throw new RuntimeUnavailableError(
				"The configured local Talk-to-Pi runtime or model does not exist.",
			);
		}
		return true;
	}

	private async isExecutable(path: string): Promise<boolean> {
		try {
			await access(path, constants.X_OK);
			return (await stat(path)).isFile();
		} catch {
			return false;
		}
	}

	private async isRegularFile(path: string): Promise<boolean> {
		try {
			return (await stat(path)).isFile();
		} catch {
			return false;
		}
	}
}

export function createSessionId(): string {
	return randomUUID();
}
