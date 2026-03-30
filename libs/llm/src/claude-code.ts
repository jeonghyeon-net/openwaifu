import {
	type McpServerConfig as AgentMcpServerConfig,
	type Query,
	query,
	type SDKMessage,
	type SDKUserMessage,
} from "@anthropic-ai/claude-agent-sdk";
import { injectable } from "tsyringe";
import {
	type ChatAttachment,
	ChatBot,
	type ChatOptions,
	type ChatResult,
	type McpServerFactory,
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
	turnId: number;
};

@injectable()
export class ClaudeCodeBot extends ChatBot {
	readonly name = "claude-code";
	private sessions = new Map<string, Session>();
	private mcpFactory: McpServerFactory = () => ({});
	private systemPrompt = "";

	setSystemPrompt(prompt: string) {
		this.systemPrompt = prompt;
	}

	async interrupt(sessionId: string) {
		const session = this.sessions.get(sessionId);
		if (!session) throw new Error(`Session not found: ${sessionId}`);
		session.turnId++;
		await session.query.interrupt();
	}

	setMcpServers(factory: McpServerFactory) {
		this.mcpFactory = factory;
	}

	private createSession(resumeId?: string): Session {
		const stream = new MessageStream();
		const mcpServers = this.mcpFactory();

		const q = query({
			prompt: stream as AsyncIterable<never>,
			options: {
				includePartialMessages: true,
				permissionMode: "bypassPermissions",
				allowDangerouslySkipPermissions: true,
				mcpServers: mcpServers as Record<string, AgentMcpServerConfig>,
				...(resumeId && { resume: resumeId }),
				...(this.systemPrompt && {
					systemPrompt: {
						type: "preset" as const,
						preset: "claude_code" as const,
						append: this.systemPrompt,
					},
				}),
			},
		});

		const session: Session = {
			stream,
			query: q,
			iterator: q[Symbol.asyncIterator](),
			sessionId: resumeId ?? null,
			turnId: 0,
		};

		if (resumeId) {
			this.sessions.set(resumeId, session);
		}

		return session;
	}

	private buildContent(
		message: string,
		attachments?: ChatAttachment[],
	): SDKUserMessage["message"]["content"] {
		if (!attachments || attachments.length === 0) return message;

		const content: Array<
			| { type: "image"; source: { type: "url"; url: string } }
			| { type: "text"; text: string }
		> = [];
		for (const att of attachments) {
			if (att.contentType.startsWith("image/")) {
				content.push({
					type: "image",
					source: { type: "url", url: att.url },
				});
			} else {
				content.push({
					type: "text",
					text: `[Attached file: ${att.filename} (${att.contentType})]`,
				});
			}
		}
		if (message) {
			content.push({ type: "text", text: message });
		}
		return content;
	}

	chat(message: string, options?: ChatOptions): ChatResult {
		let existing = options?.sessionId
			? this.sessions.get(options.sessionId)
			: undefined;

		// 저장된 sessionId가 있지만 메모리에 없으면 resume
		if (!existing && options?.sessionId) {
			existing = this.createSession(options.sessionId);
		}

		const session = existing ?? this.createSession();
		session.turnId++;
		const myTurn = session.turnId;

		const self = this;
		let sessionId = options?.sessionId ?? "";

		session.stream.push({
			type: "user",
			message: {
				role: "user",
				content: this.buildContent(message, options?.attachments),
			},
			parent_tool_use_id: null,
		});

		const responseStream = async function* () {
			for (;;) {
				const { value: msg, done } = await session.iterator.next();
				if (done) return;

				if (session.turnId !== myTurn) return;

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
