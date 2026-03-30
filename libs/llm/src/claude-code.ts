import {
	type McpServerConfig as AgentMcpServerConfig,
	type Query,
	query,
	type SDKUserMessage,
} from "@anthropic-ai/claude-agent-sdk";
import { injectable } from "tsyringe";
import {
	ChatBot,
	type ChatOptions,
	type ChatResult,
	type McpServerConfig,
} from "./chatbot.js";

@injectable()
export class ClaudeCodeBot extends ChatBot {
	private sessions = new Map<string, Query>();

	async setMcpServers(
		servers: Record<string, McpServerConfig>,
		sessionId?: string,
	) {
		const target = sessionId ? this.sessions.get(sessionId) : undefined;
		if (!target) throw new Error("Session not found");
		await target.setMcpServers(servers as Record<string, AgentMcpServerConfig>);
	}

	chat(message: string, options?: ChatOptions): ChatResult {
		let sessionId = options?.sessionId ?? "";
		const existing = options?.sessionId
			? this.sessions.get(options.sessionId)
			: undefined;

		const self = this;

		const stream = async function* () {
			if (existing) {
				const userMessage: SDKUserMessage = {
					type: "user",
					message: { role: "user", content: message },
					parent_tool_use_id: null,
				};

				await existing.streamInput(
					(async function* () {
						yield userMessage;
					})(),
				);

				for await (const msg of existing) {
					if (
						msg.type === "stream_event" &&
						msg.event.type === "content_block_delta" &&
						msg.event.delta.type === "text_delta"
					) {
						yield msg.event.delta.text;
					}

					if ("result" in msg) break;
				}
			} else {
				const q = query({
					prompt: message,
					options: {
						allowedTools: [],
						includePartialMessages: true,
					},
				});

				for await (const msg of q) {
					if (msg.type === "system" && msg.subtype === "init") {
						sessionId = msg.session_id;
						self.sessions.set(sessionId, q);
					}

					if (
						msg.type === "stream_event" &&
						msg.event.type === "content_block_delta" &&
						msg.event.delta.type === "text_delta"
					) {
						yield msg.event.delta.text;
					}

					if ("result" in msg) break;
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
