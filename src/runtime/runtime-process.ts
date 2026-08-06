import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { randomUUID } from "node:crypto";
import { Buffer } from "node:buffer";
import {
	encodeProtocolMessage,
	JsonlDecoder,
	parseProtocolLine,
	ProtocolError,
	type ProtocolEnvelope,
	type RuntimeCommandInput,
	type RuntimeMessage,
} from "./protocol.js";

export interface RuntimeProcessOptions {
	runtimePath: string;
	modelPath: string;
	protocolVersion: 1;
	threads?: number;
	startupTimeoutMs?: number;
	env?: NodeJS.ProcessEnv;
}

export type RuntimeMessageHandler = (message: RuntimeMessage) => void;
export type RuntimeFailureHandler = (error: Error) => void;

interface PendingResponse {
	resolve: (message: RuntimeMessage) => void;
	reject: (error: Error) => void;
	timer: NodeJS.Timeout;
}

export class RuntimeProcess {
	private child: ChildProcessWithoutNullStreams | undefined;
	private decoder = new JsonlDecoder();
	private readonly pending = new Map<string, PendingResponse>();
	private readonly messageHandlers = new Set<RuntimeMessageHandler>();
	private readonly failureHandlers = new Set<RuntimeFailureHandler>();
	private sequence = 0;
	private stderrBuffer = "";
	private starting: Promise<void> | undefined;

	constructor(private readonly options: RuntimeProcessOptions) {}

	get isAlive(): boolean {
		return (
			this.child !== undefined &&
			this.child.exitCode === null &&
			!this.child.killed
		);
	}

	get stderr(): string {
		return this.stderrBuffer;
	}

	onMessage(handler: RuntimeMessageHandler): () => void {
		this.messageHandlers.add(handler);
		return () => this.messageHandlers.delete(handler);
	}

	onFailure(handler: RuntimeFailureHandler): () => void {
		this.failureHandlers.add(handler);
		return () => this.failureHandlers.delete(handler);
	}

	async start(): Promise<void> {
		if (this.isAlive) return;
		if (this.starting) return this.starting;

		this.starting = this.startInternal().finally(() => {
			this.starting = undefined;
		});
		return this.starting;
	}

	private async startInternal(): Promise<void> {
		this.decoder = new JsonlDecoder();
		this.sequence = 0;
		this.stderrBuffer = "";
		this.child = spawn(
			this.options.runtimePath,
			[
				"--stdio",
				"--model",
				this.options.modelPath,
				"--protocol-version",
				String(this.options.protocolVersion),
				"--threads",
				String(this.options.threads ?? 0),
			],
			{
				stdio: ["pipe", "pipe", "pipe"],
				shell: false,
				windowsHide: true,
				env: { ...process.env, ...this.options.env },
			},
		);

		const child = this.child;
		child.stdout.setEncoding("utf8");
		child.stderr.setEncoding("utf8");
		child.stdout.on("data", (chunk: string) => this.handleStdout(chunk));
		child.stderr.on("data", (chunk: string) => this.handleStderr(chunk));
		child.on("error", (error) => this.fail(error));
		child.on("exit", (code, signal) => {
			this.child = undefined;
			const detail = signal
				? `signal ${signal}`
				: `exit code ${code ?? "unknown"}`;
			this.fail(new Error(`Talk-to-Pi runtime exited with ${detail}.`));
		});

		await this.waitForMessage(
			(message) => message.type === "hello",
			this.options.startupTimeoutMs ?? 10_000,
			"Runtime did not send hello.",
		);
		await this.waitForMessage(
			(message) => message.type === "ready",
			this.options.startupTimeoutMs ?? 30_000,
			"Runtime did not become ready.",
		);
	}

	async sendCommand(
		command: RuntimeCommandInput,
		timeoutMs = 5_000,
	): Promise<RuntimeMessage> {
		if (!this.child || !this.isAlive)
			throw new Error("Talk-to-Pi runtime is not running.");
		const id = command.id ?? randomUUID();
		const message = { ...command, v: 1, id } as RuntimeCommandInput & {
			v: 1;
			id: string;
		};
		const encoded = encodeProtocolMessage(message as ProtocolEnvelope);

		return new Promise<RuntimeMessage>((resolve, reject) => {
			const timer = setTimeout(() => {
				this.pending.delete(id);
				reject(new Error(`Runtime command timed out: ${message.type}`));
			}, timeoutMs);
			this.pending.set(id, { resolve, reject, timer });
			this.child?.stdin.write(encoded, (error) => {
				if (!error) return;
				clearTimeout(timer);
				this.pending.delete(id);
				reject(error);
			});
		});
	}

	async shutdown(): Promise<void> {
		const child = this.child;
		if (!child) return;

		try {
			await this.sendCommand({ type: "shutdown" }, 2_000);
		} catch {
			// The escalation below is the fallback for a crashed or unresponsive runtime.
		}

		await this.waitForExit(child, 2_000);
		if (this.child === child && child.exitCode === null) child.kill("SIGTERM");
		await this.waitForExit(child, 1_000);
		if (this.child === child && child.exitCode === null) child.kill("SIGKILL");
		this.child = undefined;
		this.rejectPending(new Error("Runtime shut down."));
	}

	private handleStdout(chunk: string): void {
		try {
			for (const message of this.decoder.feed(chunk))
				this.handleMessage(message);
		} catch (error) {
			this.fail(error instanceof Error ? error : new Error(String(error)));
		}
	}

	private handleMessage(message: RuntimeMessage): void {
		if (typeof message.seq === "number") {
			if (message.seq <= this.sequence)
				this.fail(
					new ProtocolError(
						"SEQUENCE_REGRESSION",
						"Runtime sequence regressed.",
					),
				);
			this.sequence = Math.max(this.sequence, message.seq);
		}

		if (typeof message.id === "string") {
			const pending = this.pending.get(message.id);
			if (pending) {
				this.pending.delete(message.id);
				clearTimeout(pending.timer);
				if (message.type === "error") {
					pending.reject(
						new Error(
							typeof message.message === "string"
								? message.message
								: "Runtime rejected command.",
						),
					);
				} else {
					pending.resolve(message);
				}
			}
		}

		for (const handler of this.messageHandlers) handler(message);
	}

	private handleStderr(chunk: string): void {
		this.stderrBuffer = `${this.stderrBuffer}${chunk}`.slice(-16 * 1024);
	}

	private async waitForMessage(
		predicate: (message: RuntimeMessage) => boolean,
		timeoutMs: number,
		timeoutMessage: string,
	): Promise<RuntimeMessage> {
		return new Promise((resolve, reject) => {
			const timer = setTimeout(() => {
				cleanup();
				reject(new Error(timeoutMessage));
			}, timeoutMs);
			const off = this.onMessage((message) => {
				if (!predicate(message)) return;
				cleanup();
				resolve(message);
			});
			const onFailure = this.onFailure((error) => {
				cleanup();
				reject(error);
			});
			const cleanup = () => {
				clearTimeout(timer);
				off();
				onFailure();
			};
		});
	}

	private async waitForExit(
		child: ChildProcessWithoutNullStreams,
		timeoutMs: number,
	): Promise<void> {
		if (child.exitCode !== null) return;
		await new Promise<void>((resolve) => {
			const timer = setTimeout(() => {
				child.off("exit", onExit);
				resolve();
			}, timeoutMs);
			const onExit = () => {
				clearTimeout(timer);
				resolve();
			};
			child.once("exit", onExit);
		});
	}

	private fail(error: Error): void {
		this.rejectPending(error);
		for (const handler of this.failureHandlers) handler(error);
	}

	private rejectPending(error: Error): void {
		for (const [id, pending] of this.pending) {
			clearTimeout(pending.timer);
			pending.reject(error);
			this.pending.delete(id);
		}
	}
}
