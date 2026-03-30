import {
	type McpServerConfig as AgentMcpServerConfig,
	type Query,
	query,
	type SDKMessage,
	type SDKUserMessage,
} from "@anthropic-ai/claude-agent-sdk";
import { injectable } from "tsyringe";
import {
	ChatBot,
	type ChatOptions,
	type ChatResult,
	type McpServerConfig,
} from "./chatbot.js";

function isTextDelta(msg: SDKMessage): string | null {
	if (
		msg.type === "stream_event" &&
		msg.event.type === "content_block_delta" &&
		msg.event.delta.type === "text_delta"
	) {
		return msg.event.delta.text;
	}
	return null;
}

function isIdle(msg: SDKMessage): boolean {
	return (
		msg.type === "system" &&
		msg.subtype === "session_state_changed" &&
		msg.state === "idle"
	);
}

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
			if (!target) throw new Error(`Session not found: ${sessionId}`);
			await target.setMcpServers(
				servers as Record<string, AgentMcpServerConfig>,
			);
		}
	}

	chat(message: string, options?: ChatOptions): ChatResult {
		let sessionId = options?.sessionId ?? "";
		const existing = options?.sessionId
			? this.sessions.get(options.sessionId)
			: undefined;

		const self = this;

		const stream = async function* () {
			let q: Query;

			if (existing) {
				q = existing;

				const userMessage: SDKUserMessage = {
					type: "user",
					message: { role: "user", content: message },
					parent_tool_use_id: null,
				};

				await q.streamInput(
					(async function* () {
						yield userMessage;
					})(),
				);
			} else {
				q = query({
					prompt: message,
					options: {
						includePartialMessages: true,
						permissionMode: "bypassPermissions",
						allowDangerouslySkipPermissions: true,
						mcpServers: self.mcpServers as Record<string, AgentMcpServerConfig>,
					},
				});
			}

			// 수동 iteration — break 없이 idle에서 return하면 generator를 닫지 않음
			for (;;) {
				const { value: msg, done } = await q.next();
				if (done) return;

				if (msg.type === "system" && msg.subtype === "init") {
					sessionId = msg.session_id;
					self.sessions.set(sessionId, q);
				}

				const text = isTextDelta(msg);
				if (text !== null) {
					yield text;
				}

				if (isIdle(msg)) return;
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
