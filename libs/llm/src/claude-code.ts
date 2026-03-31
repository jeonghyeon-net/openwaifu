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

/**
 * SDK iterator를 독점으로 읽고, 현재 턴의 listener에게 이벤트를 전달하는 pump.
 * reset() 호출 시 이전 턴의 listener를 즉시 종료하고, 남은 이벤트를 버린다.
 */
class EventPump {
	private listener: ((msg: SDKMessage | null) => void) | null = null;
	private buffer: SDKMessage[] = [];
	private skipUntilResult = false;

	constructor(iterator: AsyncIterator<SDKMessage>) {
		this.run(iterator);
	}

	private async run(iterator: AsyncIterator<SDKMessage>) {
		try {
			for (;;) {
				const { value: msg, done } = await iterator.next();
				if (done) break;

				if (this.skipUntilResult) {
					if (msg.type === "result") {
						this.skipUntilResult = false;
						continue; // result 자체도 skip
					}
					// 새 턴의 message_start → skip 종료, 이 이벤트는 dispatch
					if (
						msg.type === "stream_event" &&
						msg.event.type === "message_start"
					) {
						this.skipUntilResult = false;
					} else {
						continue;
					}
				}

				this.dispatch(msg);
			}
		} catch {
			// iterator error (e.g. process terminated) — signal end
		}
		this.dispatch(null);
	}

	private dispatch(msg: SDKMessage | null) {
		if (this.listener) {
			const cb = this.listener;
			this.listener = null;
			cb(msg);
		} else if (msg !== null) {
			this.buffer.push(msg);
		}
	}

	pull(): Promise<SDKMessage | null> {
		if (this.buffer.length > 0) {
			const msg = this.buffer.shift();
			if (msg !== undefined) return Promise.resolve(msg);
		}
		return new Promise((resolve) => {
			this.listener = resolve;
		});
	}

	/** 이전 턴의 listener를 즉시 종료하고, 남은 이벤트를 버린다. */
	reset() {
		this.buffer.length = 0;
		this.skipUntilResult = true;
		if (this.listener) {
			const cb = this.listener;
			this.listener = null;
			cb(null);
		}
	}
}

type Session = {
	stream: MessageStream;
	query: Query;
	pump: EventPump;
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
			pump: new EventPump(q[Symbol.asyncIterator]()),
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

		// 이전 턴이 진행 중이면 즉시 중단:
		// 1) pump.reset() → 이전 generator를 null로 즉시 깨움 + 남은 이벤트 skip
		// 2) query.interrupt() → SDK에 중단 신호 (fire-and-forget)
		session.pump.reset();
		session.query.interrupt().catch(() => {});

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
			let hasYielded = false;

			for (;;) {
				if (session.turnId !== myTurn) return;

				const msg = await session.pump.pull();
				if (msg === null) return;

				if (msg.type === "system" && msg.subtype === "init") {
					session.sessionId = msg.session_id;
					sessionId = msg.session_id;
					self.sessions.set(sessionId, session);
				}

				// 새 텍스트 블록 시작 = tool 호출 후 새 응답 → 새 메시지로 분리
				if (
					msg.type === "stream_event" &&
					msg.event.type === "content_block_start" &&
					msg.event.content_block.type === "text" &&
					hasYielded
				) {
					yield { type: "message_break" as const };
				}

				const text = isTextDelta(msg);
				if (text !== null) {
					hasYielded = true;
					yield { type: "text" as const, text };
				}

				if (msg.type === "result") return;
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
