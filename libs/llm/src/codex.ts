import { randomUUID } from "node:crypto";
import { unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	Codex,
	type Input,
	type Thread,
	type UserInput,
} from "@openai/codex-sdk";
import { injectable } from "tsyringe";
import {
	type ChatAttachment,
	ChatBot,
	type ChatOptions,
	type ChatResult,
	type McpServerConfig,
	type McpServerFactory,
} from "./chatbot.js";

type CodexConfigValue =
	| string
	| number
	| boolean
	| CodexConfigValue[]
	| { [key: string]: CodexConfigValue };

function isStdio(
	server: McpServerConfig,
): server is { type?: "stdio"; command: string; args?: string[] } {
	return "command" in server;
}

function buildCodex(
	mcpServers: Record<string, McpServerConfig>,
	systemPrompt?: string,
): Codex {
	const mcpConfig: { [key: string]: CodexConfigValue } = {};
	for (const [name, server] of Object.entries(mcpServers)) {
		if (!isStdio(server)) continue;
		const entry: { command: string; args?: string[] } = {
			command: server.command,
		};
		if (server.args && server.args.length > 0) entry.args = server.args;
		mcpConfig[name] = entry;
	}

	const config: { [key: string]: CodexConfigValue } = {};
	if (Object.keys(mcpConfig).length > 0) config["mcp_servers"] = mcpConfig;
	if (systemPrompt) config["instructions"] = systemPrompt;
	if (Object.keys(config).length === 0) return new Codex();
	return new Codex({ config });
}

@injectable()
export class CodexBot extends ChatBot {
	readonly name = "codex";
	private codex: Codex | null = null;
	private mcpFactory: McpServerFactory = () => ({});
	private systemPrompt = "";
	private threads = new Map<string, Thread>();
	private locks = new Map<string, Promise<void>>();

	setSystemPrompt(prompt: string) {
		this.systemPrompt = prompt;
		this.codex = null;
	}

	async interrupt() {
		// Codex responds in one shot — queuing handles concurrency instead
	}

	setMcpServers(factory: McpServerFactory) {
		this.mcpFactory = factory;
		this.codex = null;
	}

	private getCodex(): Codex {
		if (!this.codex) {
			this.codex = buildCodex(this.mcpFactory(), this.systemPrompt);
		}
		return this.codex;
	}

	private getThread(sessionId?: string): Thread {
		if (sessionId) {
			let thread = this.threads.get(sessionId);
			if (!thread) {
				thread = this.getCodex().resumeThread(sessionId);
				this.threads.set(sessionId, thread);
			}
			return thread;
		}
		return this.getCodex().startThread({ approvalPolicy: "never" });
	}

	private static async buildInput(
		message: string,
		attachments?: ChatAttachment[],
	): Promise<{ input: Input; cleanup: () => void }> {
		if (!attachments || attachments.length === 0) {
			return { input: message, cleanup: () => {} };
		}

		const parts: UserInput[] = [];
		const tempFiles: string[] = [];

		for (const att of attachments) {
			if (att.contentType.startsWith("image/")) {
				try {
					const res = await fetch(att.url);
					const buf = Buffer.from(await res.arrayBuffer());
					const ext = att.filename.split(".").pop() ?? "jpg";
					const path = join(tmpdir(), `codex-img-${randomUUID()}.${ext}`);
					writeFileSync(path, buf);
					tempFiles.push(path);
					parts.push({ type: "local_image", path });
				} catch {
					parts.push({
						type: "text",
						text: `[Image unavailable: ${att.filename}]`,
					});
				}
			} else {
				parts.push({
					type: "text",
					text: `[File: ${att.filename} (${att.url})]`,
				});
			}
		}

		if (message) {
			parts.push({ type: "text", text: message });
		}

		const cleanup = () => {
			for (const f of tempFiles) {
				try {
					unlinkSync(f);
				} catch {
					// already deleted
				}
			}
		};

		return { input: parts, cleanup };
	}

	chat(message: string, options?: ChatOptions): ChatResult {
		let sessionId = options?.sessionId ?? "";
		const lockKey = sessionId || "new";

		const self = this;

		const stream = async function* () {
			// 이전 요청이 끝날 때까지 대기
			const prev = self.locks.get(lockKey);
			if (prev) await prev.catch(() => {});

			const thread = self.getThread(sessionId || undefined);
			let resolve: (() => void) | undefined;
			const lock = new Promise<void>((r) => {
				resolve = r;
			});
			self.locks.set(lockKey, lock);

			const { input, cleanup } = await CodexBot.buildInput(
				message,
				options?.attachments,
			);

			try {
				const { events } = await thread.runStreamed(input);
				const seen = new Map<string, number>();

				for await (const event of events) {
					if (event.type === "thread.started") {
						sessionId = event.thread_id;
						self.threads.set(sessionId, thread);
						self.locks.delete(lockKey);
						self.locks.set(sessionId, lock);
					}

					if (
						(event.type === "item.updated" ||
							event.type === "item.completed") &&
						event.item.type === "agent_message"
					) {
						const prev = seen.get(event.item.id) ?? 0;
						const text = event.item.text;
						if (text.length > prev) {
							yield { type: "text" as const, text: text.slice(prev) };
							seen.set(event.item.id, text.length);
						}
					}
				}
			} finally {
				cleanup();
				resolve?.();
				self.locks.delete(sessionId || lockKey);
			}
		};

		return {
			get sessionId() {
				return sessionId;
			},
			stream: stream(),
		};
	}
}
