import { existsSync, watch } from "node:fs";
import { join } from "node:path";
import {
	type McpServerConfig as AgentMcpServerConfig,
	type Query,
	query,
	type SDKMessage,
	type SDKUserMessage,
} from "@anthropic-ai/claude-agent-sdk";
import { env } from "@lib/env";
import {
	type Attachment,
	Bot,
	type BotConfig,
	type StreamChunk,
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

	get active(): boolean {
		return this.listener !== null || this.buffer.length > 0;
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
	attachments?: Attachment[],
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

export class ClaudeCodeBot extends Bot {
	private turnId = 0;
	private _sessionId: string;
	private sdkStream: MessageStream;
	private q: Query;
	private pump: EventPump;

	constructor(config: BotConfig) {
		super();

		const model = env("CLAUDE_MODEL", "claude-sonnet-4-6");
		const thinking = env("CLAUDE_THINKING", "disabled");
		const effort = env("CLAUDE_EFFORT", "high");

		const thinkingConfig =
			thinking === "disabled"
				? { type: "disabled" as const }
				: thinking === "adaptive"
					? { type: "adaptive" as const }
					: { type: "enabled" as const, budgetTokens: Number(thinking) };

		this.sdkStream = new MessageStream();
		this.q = query({
			prompt: this.sdkStream as AsyncIterable<never>,
			options: {
				model,
				thinking: thinkingConfig,
				effort: effort as "low" | "medium" | "high",
				tools: { type: "preset" as const, preset: "claude_code" as const },
				includePartialMessages: true,
				permissionMode: "bypassPermissions",
				allowDangerouslySkipPermissions: true,
				plugins: config.pluginDirs
					.filter((d) => existsSync(d))
					.map((path) => ({ type: "local" as const, path })),
				mcpServers: config.mcpServers as Record<string, AgentMcpServerConfig>,
				...(config.resume && { resume: config.resume }),
				...(config.systemPrompt && {
					systemPrompt: {
						type: "preset" as const,
						preset: "claude_code" as const,
						append: config.systemPrompt,
					},
				}),
			},
		});

		this.pump = new EventPump(this.q[Symbol.asyncIterator]());
		this._sessionId = config.resume ?? "";

		// plugin 내 skills 디렉토리 변경 감지 → reloadPlugins
		for (const dir of config.pluginDirs) {
			const skillsDir = join(dir, "skills");
			if (existsSync(skillsDir)) {
				watch(skillsDir, { recursive: true }, () => {
					this.q.reloadPlugins().catch(() => {});
				});
			}
		}
	}

	get sessionId() {
		return this._sessionId;
	}

	send(
		message: string,
		attachments?: Attachment[],
	): AsyncIterable<StreamChunk> {
		if (this.pump.active) {
			this.pump.reset();
			this.q.interrupt().catch(() => {});
		}

		this.turnId++;
		const myTurn = this.turnId;

		this.sdkStream.push({
			type: "user",
			message: { role: "user", content: buildContent(message, attachments) },
			parent_tool_use_id: null,
		});

		const pump = this.pump;
		const self = this;

		async function* responseStream() {
			let hadTool = false;

			for (;;) {
				if (self.turnId !== myTurn) return;
				const msg = await pump.pull();
				if (msg === null) return;

				if (msg.type === "system" && msg.subtype === "init") {
					self._sessionId = msg.session_id;
				}

				// tool 호출 감지
				if (
					msg.type === "stream_event" &&
					msg.event.type === "content_block_start" &&
					msg.event.content_block.type === "tool_use"
				) {
					hadTool = true;
				}

				const text = isTextDelta(msg);
				if (text) {
					// tool 호출 후 첫 텍스트 → 줄바꿈으로 구분
					if (hadTool) {
						hadTool = false;
						yield { type: "text" as const, text: "\n" };
					}
					yield { type: "text" as const, text };
				}
				if (msg.type === "result") return;
			}
		}

		return responseStream();
	}
}
