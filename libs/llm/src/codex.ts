import { Codex, type Thread } from "@openai/codex-sdk";
import { injectable } from "tsyringe";
import {
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

function buildCodex(mcpServers: Record<string, McpServerConfig>): Codex {
	const mcpConfig: { [key: string]: CodexConfigValue } = {};
	for (const [name, server] of Object.entries(mcpServers)) {
		if (!isStdio(server)) continue;
		const entry: { command: string; args?: string[] } = {
			command: server.command,
		};
		if (server.args && server.args.length > 0) entry.args = server.args;
		mcpConfig[name] = entry;
	}

	if (Object.keys(mcpConfig).length === 0) return new Codex();
	return new Codex({ config: { mcp_servers: mcpConfig } });
}

@injectable()
export class CodexBot extends ChatBot {
	readonly name = "codex";
	private codex: Codex | null = null;
	private mcpFactory: McpServerFactory = () => ({});
	private threads = new Map<string, Thread>();
	private turnCounters = new Map<string, number>();

	async interrupt(sessionId: string) {
		const current = this.turnCounters.get(sessionId) ?? 0;
		this.turnCounters.set(sessionId, current + 1);
	}

	setMcpServers(factory: McpServerFactory) {
		this.mcpFactory = factory;
		this.codex = null;
	}

	private getCodex(): Codex {
		if (!this.codex) {
			this.codex = buildCodex(this.mcpFactory());
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

	chat(message: string, options?: ChatOptions): ChatResult {
		let sessionId = options?.sessionId ?? "";
		const thread = this.getThread(options?.sessionId);

		const currentTurn = (this.turnCounters.get(sessionId) ?? 0) + 1;
		if (sessionId) {
			this.turnCounters.set(sessionId, currentTurn);
		}

		const self = this;

		const stream = async function* () {
			const { events } = await thread.runStreamed(message);
			const seen = new Map<string, number>();

			for await (const event of events) {
				if (event.type === "thread.started") {
					sessionId = event.thread_id;
					self.threads.set(sessionId, thread);
					self.turnCounters.set(sessionId, currentTurn);
				}

				if (self.turnCounters.get(sessionId) !== currentTurn) return;

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
		};

		return {
			get sessionId() {
				return sessionId;
			},
			stream: stream(),
		};
	}
}
