import { Codex, type Thread } from "@openai/codex-sdk";
import { injectable } from "tsyringe";
import {
	ChatBot,
	type ChatOptions,
	type ChatResult,
	type McpServerConfig,
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

function buildCodex(mcpServers?: Record<string, McpServerConfig>): Codex {
	if (!mcpServers || Object.keys(mcpServers).length === 0) {
		return new Codex();
	}

	const mcpConfig: { [key: string]: CodexConfigValue } = {};
	for (const [name, server] of Object.entries(mcpServers)) {
		if (!isStdio(server)) continue;
		const entry: { command: string; args?: string[] } = {
			command: server.command,
		};
		if (server.args && server.args.length > 0) entry.args = server.args;
		mcpConfig[name] = entry;
	}

	return new Codex({ config: { mcp_servers: mcpConfig } });
}

@injectable()
export class CodexBot extends ChatBot {
	private codex: Codex;
	private threads = new Map<string, Thread>();
	private abortControllers = new Map<string, AbortController>();

	constructor() {
		super();
		this.codex = new Codex();
	}

	async interrupt(sessionId: string) {
		const controller = this.abortControllers.get(sessionId);
		if (controller) {
			controller.abort();
			this.abortControllers.delete(sessionId);
		}
	}

	async setMcpServers(servers: Record<string, McpServerConfig>) {
		if (this.threads.size > 0) {
			throw new Error(
				"Cannot change MCP servers while sessions are active. Create a new CodexBot instance instead.",
			);
		}
		this.codex = buildCodex(servers);
	}

	private getThread(sessionId?: string): Thread {
		if (sessionId) {
			let thread = this.threads.get(sessionId);
			if (!thread) {
				thread = this.codex.resumeThread(sessionId);
				this.threads.set(sessionId, thread);
			}
			return thread;
		}
		return this.codex.startThread({ approvalPolicy: "never" });
	}

	chat(message: string, options?: ChatOptions): ChatResult {
		let sessionId = options?.sessionId ?? "";
		const thread = this.getThread(options?.sessionId);

		const self = this;
		const controller = new AbortController();

		const stream = async function* () {
			const { events } = await thread.runStreamed(message, {
				signal: controller.signal,
			});
			const seen = new Map<string, number>();

			for await (const event of events) {
				if (event.type === "thread.started") {
					sessionId = event.thread_id;
					self.threads.set(sessionId, thread);
					self.abortControllers.set(sessionId, controller);
				}

				if (
					(event.type === "item.updated" || event.type === "item.completed") &&
					event.item.type === "agent_message"
				) {
					const prev = seen.get(event.item.id) ?? 0;
					const text = event.item.text;
					if (text.length > prev) {
						yield text.slice(prev);
						seen.set(event.item.id, text.length);
					}
				}
			}

			self.abortControllers.delete(sessionId);
		};

		return {
			get sessionId() {
				return sessionId;
			},
			stream: stream(),
		};
	}
}
