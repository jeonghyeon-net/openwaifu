import { existsSync, readFileSync, watch } from "node:fs";
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

/** 이미지 전송 대상 MCP 도구 이름 */
const IMAGE_FORWARD_TOOLS = new Set(["browser_take_screenshot"]);

const IMAGE_EXT_RE = /\/?[\w./~-]+\.(?:png|jpe?g|webp)/i;

/** MCP 도구 결과에서 이미지를 추출한다 (base64 또는 파일 경로). */
function* extractImages(content: unknown): Generator<StreamChunk> {
	if (Array.isArray(content)) {
		for (const block of content) {
			const b = block as Record<string, unknown>;
			// base64 이미지
			if (b["type"] === "image") {
				const src = b["source"] as Record<string, unknown> | undefined;
				if (src?.["type"] === "base64" && typeof src["data"] === "string") {
					yield {
						type: "image",
						data: Buffer.from(src["data"], "base64"),
						mediaType:
							typeof src["media_type"] === "string"
								? src["media_type"]
								: "image/png",
					};
					return;
				}
			}
		}
	}

	// 파일 경로 (.png/.jpg 등)
	const text =
		typeof content === "string"
			? content
			: Array.isArray(content)
				? (content as Array<Record<string, unknown>>)
						.filter((b) => b["type"] === "text")
						.map((b) => b["text"])
						.join("")
				: "";
	const match = IMAGE_EXT_RE.exec(text);
	if (match?.[0] && existsSync(match[0])) {
		try {
			const ext = match[0].split(".").pop() ?? "png";
			yield {
				type: "image",
				data: readFileSync(match[0]),
				mediaType: `image/${ext === "jpg" ? "jpeg" : ext}`,
			};
		} catch {
			// 파일 읽기 실패
		}
	}
}

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
		return this.listener !== null;
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
	private watchers: ReturnType<typeof watch>[] = [];

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
				this.watchers.push(
					watch(skillsDir, { recursive: true }, () => {
						this.q.reloadPlugins().catch(() => {});
					}),
				);
			}
		}
	}

	get sessionId() {
		return this._sessionId;
	}

	override destroy() {
		for (const w of this.watchers) w.close();
		this.sdkStream.end();
		this.q.close();
	}

	override async contextUsage(): Promise<number> {
		try {
			const usage = await this.q.getContextUsage();
			return usage.percentage;
		} catch {
			return 0;
		}
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
			const imageToolIds = new Set<string>();

			for (;;) {
				if (self.turnId !== myTurn) return;
				const msg = await pump.pull();
				if (msg === null) return;

				if (msg.type === "system" && msg.subtype === "init") {
					self._sessionId = msg.session_id;
				}

				if (msg.type !== "stream_event") {
					if (msg.type === "result") return;
					continue;
				}

				const ev = msg.event;
				if (ev.type !== "content_block_start") {
					const text = isTextDelta(msg);
					if (text) {
						if (hadTool) {
							hadTool = false;
							yield { type: "text" as const, text: "\n" };
						}
						yield { type: "text" as const, text };
					}
					continue;
				}

				const block = ev.content_block;

				if (block.type === "tool_use") {
					hadTool = true;
				}

				if (block.type === "mcp_tool_use") {
					hadTool = true;
					const b = block as unknown as { id: string; name: string };
					if (IMAGE_FORWARD_TOOLS.has(b.name)) {
						imageToolIds.add(b.id);
					}
				}

				if (block.type === "mcp_tool_result") {
					hadTool = true;
					const b = block as unknown as {
						tool_use_id: string;
						content: unknown;
					};
					if (imageToolIds.delete(b.tool_use_id)) {
						yield* extractImages(b.content);
					}
				}
			}
		}

		return responseStream();
	}
}
