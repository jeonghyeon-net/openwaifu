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

type TurnChannel = {
	push(text: string): void;
	end(): void;
};

function createTurnChannel(): TurnChannel & { stream: AsyncIterable<string> } {
	const queue: string[] = [];
	let done = false;
	let resolve: (() => void) | null = null;

	const stream: AsyncIterable<string> = {
		[Symbol.asyncIterator]() {
			return {
				async next() {
					while (queue.length === 0 && !done) {
						await new Promise<void>((r) => {
							resolve = r;
						});
					}
					if (queue.length > 0) {
						const val = queue.shift();
						if (val !== undefined) {
							return { value: val, done: false };
						}
					}
					return { value: undefined, done: true };
				},
			};
		},
	};

	return {
		stream,
		push(text: string) {
			queue.push(text);
			resolve?.();
			resolve = null;
		},
		end() {
			done = true;
			resolve?.();
			resolve = null;
		},
	};
}

@injectable()
export class ClaudeCodeBot extends ChatBot {
	private sessions = new Map<string, Query>();
	private channels = new Map<string, TurnChannel>();
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

	private startPump(sessionId: string, q: Query) {
		(async () => {
			for await (const msg of q) {
				const text = isTextDelta(msg);
				if (text !== null) {
					this.channels.get(sessionId)?.push(text);
				}

				if (isIdle(msg)) {
					this.channels.get(sessionId)?.end();
				}
			}
		})();
	}

	chat(message: string, options?: ChatOptions): ChatResult {
		let sessionId = options?.sessionId ?? "";
		const existing = options?.sessionId
			? this.sessions.get(options.sessionId)
			: undefined;

		const channel = createTurnChannel();
		const self = this;

		if (existing) {
			this.channels.set(sessionId, channel);

			const userMessage: SDKUserMessage = {
				type: "user",
				message: { role: "user", content: message },
				parent_tool_use_id: null,
			};

			existing.streamInput(
				(async function* () {
					yield userMessage;
				})(),
			);
		} else {
			const q = query({
				prompt: message,
				options: {
					includePartialMessages: true,
					permissionMode: "bypassPermissions",
					allowDangerouslySkipPermissions: true,
					mcpServers: self.mcpServers as Record<string, AgentMcpServerConfig>,
				},
			});

			// pump를 시작하기 전에 init 이벤트에서 sessionId를 캡처해야 하므로
			// 첫 번째 턴은 stream에서 직접 처리
			const wrappedStream: AsyncIterable<string> = {
				[Symbol.asyncIterator]() {
					return {
						async next() {
							for (;;) {
								const { value: msg, done } = await q.next();
								if (done) {
									return { value: undefined, done: true };
								}

								if (msg.type === "system" && msg.subtype === "init") {
									sessionId = msg.session_id;
									self.sessions.set(sessionId, q);
									self.channels.set(sessionId, channel);
								}

								const text = isTextDelta(msg);
								if (text !== null) {
									return { value: text, done: false };
								}

								if (isIdle(msg)) {
									// 첫 턴 종료 후 백그라운드 pump 시작
									self.startPump(sessionId, q);
									return { value: undefined, done: true };
								}
							}
						},
					};
				},
			};

			return {
				get sessionId() {
					return sessionId;
				},
				stream: wrappedStream,
			};
		}

		return {
			get sessionId() {
				return sessionId;
			},
			stream: channel.stream,
		};
	}
}
