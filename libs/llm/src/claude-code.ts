import {
	type McpServerConfig as AgentMcpServerConfig,
	query,
	type SDKMessage,
	type SDKUserMessage,
} from "@anthropic-ai/claude-agent-sdk";
import { env } from "@lib/env";
import type {
	ChatAttachment,
	ChatBot,
	ChatBotFactory,
	ChatResult,
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
						continue;
					}
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
			// iterator error
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

function buildContent(
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
			content.push({ type: "image", source: { type: "url", url: att.url } });
		} else {
			content.push({
				type: "text",
				text: `[Attached file: ${att.filename} (${att.contentType})]`,
			});
		}
	}
	if (message) content.push({ type: "text", text: message });
	return content;
}

export const createClaudeCodeBot: ChatBotFactory = async (config, resume) => {
	const model = env("CLAUDE_MODEL", "claude-sonnet-4-6");
	const thinking = env("CLAUDE_THINKING", "disabled");
	const effort = env("CLAUDE_EFFORT", "high");

	const thinkingConfig =
		thinking === "disabled"
			? { type: "disabled" as const }
			: thinking === "adaptive"
				? { type: "adaptive" as const }
				: { type: "enabled" as const, budgetTokens: Number(thinking) };

	const stream = new MessageStream();
	const q = query({
		prompt: stream as AsyncIterable<never>,
		options: {
			model,
			thinking: thinkingConfig,
			effort: effort as "low" | "medium" | "high",
			includePartialMessages: true,
			permissionMode: "bypassPermissions",
			allowDangerouslySkipPermissions: true,
			mcpServers: config.mcpServers as Record<string, AgentMcpServerConfig>,
			...(resume && { resume }),
			...(config.systemPrompt && {
				systemPrompt: {
					type: "preset" as const,
					preset: "claude_code" as const,
					append: config.systemPrompt,
				},
			}),
		},
	});

	const pump = new EventPump(q[Symbol.asyncIterator]());

	// init 이벤트를 기다려서 sessionId 확정
	let sessionId = resume ?? "";
	for (;;) {
		const msg = await pump.pull();
		if (msg === null) throw new Error("SDK session init failed");
		if (msg.type === "system" && msg.subtype === "init") {
			sessionId = msg.session_id;
			break;
		}
	}

	let turnId = 0;

	const bot: ChatBot = {
		get sessionId() {
			return sessionId;
		},

		interrupt() {
			pump.reset();
			q.interrupt().catch(() => {});
		},

		chat(message: string, attachments?: ChatAttachment[]): ChatResult {
			pump.reset();
			q.interrupt().catch(() => {});

			turnId++;
			const myTurn = turnId;

			stream.push({
				type: "user",
				message: { role: "user", content: buildContent(message, attachments) },
				parent_tool_use_id: null,
			});

			const responseStream = async function* () {
				for (;;) {
					if (turnId !== myTurn) return;
					const msg = await pump.pull();
					if (msg === null) return;

					const text = isTextDelta(msg);
					if (text !== null) {
						yield { type: "text" as const, text };
					}
					if (msg.type === "result") return;
				}
			};

			return { stream: responseStream() };
		},
	};

	return bot;
};
