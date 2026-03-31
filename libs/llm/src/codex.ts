import { randomUUID } from "node:crypto";
import { unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { env } from "@lib/env";
import {
	Codex,
	type Input,
	type Thread,
	type UserInput,
} from "@openai/codex-sdk";
import {
	type ChatAttachment,
	ChatBot,
	type ChatBotConfig,
	type McpServerConfig,
	type StreamChunk,
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

async function buildInput(
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

	if (message) parts.push({ type: "text", text: message });

	return {
		input: parts,
		cleanup: () => {
			for (const f of tempFiles) {
				try {
					unlinkSync(f);
				} catch {
					/* already deleted */
				}
			}
		},
	};
}

export class CodexBot extends ChatBot {
	private _sessionId: string;
	private lock: Promise<void> | null = null;

	private constructor(
		private thread: Thread,
		sessionId: string,
	) {
		super();
		this._sessionId = sessionId;
	}

	get sessionId() {
		return this._sessionId;
	}

	static async create(
		config: ChatBotConfig,
		resume?: string,
	): Promise<CodexBot> {
		const codex = buildCodex(config.mcpServers, config.systemPrompt);
		const model = env("CODEX_MODEL", "");
		const effort = env("CODEX_EFFORT", "high");

		const thread = resume
			? codex.resumeThread(resume)
			: codex.startThread({
					approvalPolicy: "never",
					...(model && { model }),
					modelReasoningEffort: effort as
						| "minimal"
						| "low"
						| "medium"
						| "high"
						| "xhigh",
				});

		return new CodexBot(thread, resume ?? "");
	}

	enqueue(
		message: string,
		attachments?: ChatAttachment[],
	): AsyncIterable<StreamChunk> {
		const self = this;

		async function* responseStream() {
			// Codex는 one-shot — interrupt 대신 직렬화
			if (self.lock) await self.lock.catch(() => {});

			let resolve: (() => void) | undefined;
			self.lock = new Promise<void>((r) => {
				resolve = r;
			});

			const { input, cleanup } = await buildInput(message, attachments);
			try {
				const { events } = await self.thread.runStreamed(input);
				const seen = new Map<string, number>();

				for await (const event of events) {
					if (event.type === "thread.started") {
						self._sessionId = event.thread_id;
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
				self.lock = null;
			}
		}

		return responseStream();
	}
}
