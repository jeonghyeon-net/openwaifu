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
	private mcpServers: Record<string, McpServerConfig> = {};

	async setMcpServers(
		servers: Record<string, McpServerConfig>,
		sessionId?: string,
	) {
		this.mcpServers = servers;

		if (sessionId) {
			const target = this.sessions.get(sessionId);
			if (target) {
				await target.setMcpServers(
					servers as Record<string, AgentMcpServerConfig>,
				);
			}
		}
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
						includePartialMessages: true,
						mcpServers: self.mcpServers as Record<string, AgentMcpServerConfig>,
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
