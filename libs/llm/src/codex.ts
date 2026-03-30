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

@injectable()
export class CodexBot extends ChatBot {
	private codex: Codex;
	private threads = new Map<string, Thread>();

	constructor() {
		super();
		this.codex = new Codex();
	}

	async setMcpServers(servers: Record<string, McpServerConfig>) {
		const mcpConfig: { [key: string]: CodexConfigValue } = {};
		for (const [name, server] of Object.entries(servers)) {
			const entry: {
				command: string;
				args?: string[];
			} = { command: server.command };
			if (server.args.length > 0) entry.args = server.args;
			mcpConfig[name] = entry;
		}

		this.codex = new Codex({
			config: { mcp_servers: mcpConfig },
		});
		this.threads.clear();
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
		const stream = async function* () {
			const { events } = await thread.runStreamed(message);

			for await (const event of events) {
				if (event.type === "thread.started") {
					sessionId = event.thread_id;
					self.threads.set(sessionId, thread);
				}

				if (
					event.type === "item.updated" &&
					event.item.type === "agent_message"
				) {
					yield event.item.text;
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
