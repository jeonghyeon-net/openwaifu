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

class MessageStream {
	private queue: SDKUserMessage[] = [];
	private resolve: (() => void) | null = null;
	private done = false;

	push(msg: SDKUserMessage) {
		this.queue.push(msg);
		this.resolve?.();
		this.resolve = null;
	}

	end() {
		this.done = true;
		this.resolve?.();
		this.resolve = null;
	}

	async *[Symbol.asyncIterator](): AsyncGenerator<SDKUserMessage> {
		while (!this.done) {
			while (this.queue.length === 0 && !this.done) {
				await new Promise<void>((r) => {
					this.resolve = r;
				});
			}
			while (this.queue.length > 0) {
				const msg = this.queue.shift();
				if (msg) yield msg;
			}
		}
	}
}

type Session = {
	stream: MessageStream;
	query: Query;
	iterator: AsyncIterator<SDKMessage>;
	sessionId: string | null;
};

@injectable()
export class ClaudeCodeBot extends ChatBot {
	private sessions = new Map<string, Session>();
	private mcpServers: Record<string, McpServerConfig> = {};

	async setMcpServers(
		servers: Record<string, McpServerConfig>,
		sessionId?: string,
	) {
		this.mcpServers = servers;

		if (sessionId) {
			const target = this.sessions.get(sessionId);
			if (!target) throw new Error(`Session not found: ${sessionId}`);
			await target.query.setMcpServers(
				servers as Record<string, AgentMcpServerConfig>,
			);
		}
	}

	private createSession(): Session {
		const stream = new MessageStream();

		const q = query({
			prompt: stream as AsyncIterable<never>,
			options: {
				includePartialMessages: true,
				permissionMode: "bypassPermissions",
				allowDangerouslySkipPermissions: true,
				mcpServers: this.mcpServers as Record<string, AgentMcpServerConfig>,
			},
		});

		return {
			stream,
			query: q,
			iterator: q[Symbol.asyncIterator](),
			sessionId: null,
		};
	}

	chat(message: string, options?: ChatOptions): ChatResult {
		const existing = options?.sessionId
			? this.sessions.get(options.sessionId)
			: undefined;

		const session = existing ?? this.createSession();
		const self = this;
		let sessionId = options?.sessionId ?? "";

		// 메시지를 stream에 push
		session.stream.push({
			type: "user",
			message: { role: "user", content: message },
			parent_tool_use_id: null,
		});

		const responseStream = async function* () {
			for (;;) {
				const { value: msg, done } = await session.iterator.next();
				if (done) return;

				if (msg.type === "system" && msg.subtype === "init") {
					session.sessionId = msg.session_id;
					sessionId = msg.session_id;
					self.sessions.set(sessionId, session);
				}

				const text = isTextDelta(msg);
				if (text !== null) {
					yield text;
				}

				if ("result" in msg) return;
			}
		};

		return {
			get sessionId() {
				return sessionId;
			},
			stream: responseStream(),
		};
	}
}
