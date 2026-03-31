# Bot-per-Session Architecture Refactor

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 1 봇 = 1 세션 구조로 리팩토링. 봇은 채널을 모르고, brain의 ChannelWorker가 채널별 봇 + 큐 + interrupt를 관리.

**Architecture:**
- `ChatBot` 인터페이스: 단일 세션, `chat()` + `interrupt()`. 팩토리로 async 생성.
- `ChannelWorker`: 채널당 하나. 봇 소유, 메시지 큐(최신 1개), drain 루프. `enqueue()` → `interrupt()` → drain.
- DI 컨테이너(tsyringe) 제거. 팩토리 함수로 봇 생성.

**Tech Stack:** TypeScript, Bun, @anthropic-ai/claude-agent-sdk, @openai/codex-sdk

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `libs/llm/src/chatbot.ts` | Rewrite | `ChatBot` interface, `ChatBotFactory` type, `ChatAttachment`/`StreamChunk` types |
| `libs/llm/src/claude-code.ts` | Rewrite | `createClaudeCodeBot` factory. 1 instance = 1 session. EventPump/MessageStream internal. |
| `libs/llm/src/codex.ts` | Rewrite | `createCodexBot` factory. 1 instance = 1 session. |
| `libs/llm/src/index.ts` | Modify | Update exports (remove DI tokens, class exports) |
| `apps/brain/src/channel-worker.ts` | Create | `ChannelWorker` class: 봇 소유, 큐, drain 루프, interrupt |
| `apps/brain/src/index.ts` | Rewrite | DI 제거, ChannelWorker 기반 메시지 디스패치 |
| `libs/chat-platform/src/platform.ts` | Modify | `PLATFORM_TOKEN` 제거, `@injectable()` 제거 |
| `libs/chat-platform/src/discord.ts` | Modify | `@injectable()` 제거 |
| `libs/chat-platform/src/telegram.ts` | Modify | `@injectable()` 제거 |
| `libs/mcp-discovery/src/index.ts` | Modify | `McpServerConfig` 임포트를 SDK 타입에서 직접 가져오도록 변경 |

---

### Task 1: ChatBot interface + factory type

**Files:**
- Rewrite: `libs/llm/src/chatbot.ts`

- [ ] **Step 1: Rewrite chatbot.ts**

```typescript
import type { McpServerConfig as AgentMcpServerConfig } from "@anthropic-ai/claude-agent-sdk";

export type McpServerConfig = AgentMcpServerConfig;

export type ChatAttachment = {
	url: string;
	filename: string;
	contentType: string;
	size: number;
};

export type StreamChunk = { type: "text"; text: string };

export type ChatResult = {
	stream: AsyncIterable<StreamChunk>;
};

export interface ChatBot {
	readonly sessionId: string;
	chat(message: string, attachments?: ChatAttachment[]): ChatResult;
	interrupt(): void;
}

export type ChatBotConfig = {
	systemPrompt: string;
	mcpServers: Record<string, McpServerConfig>;
};

/** 봇 팩토리. resume가 주어지면 기존 세션 복원, 없으면 새 세션 생성. */
export type ChatBotFactory = (
	config: ChatBotConfig,
	resume?: string,
) => Promise<ChatBot>;
```

Key changes:
- `ChatBot`은 interface (abstract class X)
- `chat()`에서 `options` 객체 제거 — sessionId/key 불필요 (1봇=1세션)
- `interrupt()` 메서드 있음
- `ChatBotFactory` type 추가 — async, config + resume 인자
- `message_break` StreamChunk에서 제거
- `setSystemPrompt()`, `setMcpServers()` 제거 — config로 팩토리에 전달

- [ ] **Step 2: Run type check**

Run: `bunx tsc -p libs/llm/tsconfig.json --noEmit`
Expected: FAIL (claude-code.ts, codex.ts가 old interface 사용 중)

- [ ] **Step 3: Commit**

```bash
git add libs/llm/src/chatbot.ts
git commit -m "refactor: chatBot interface를 단일 세션 + 팩토리 패턴으로 재설계"
```

---

### Task 2: ClaudeCodeBot factory

**Files:**
- Rewrite: `libs/llm/src/claude-code.ts`

- [ ] **Step 1: Rewrite claude-code.ts**

`MessageStream`과 `EventPump`는 그대로 유지 (internal). `ClaudeCodeBot` 클래스 → `createClaudeCodeBot` 팩토리 함수로 변환.

```typescript
import {
	type McpServerConfig as AgentMcpServerConfig,
	type Query,
	query,
	type SDKMessage,
	type SDKUserMessage,
} from "@anthropic-ai/claude-agent-sdk";
import { env } from "@lib/env";
import type {
	ChatAttachment,
	ChatBot,
	ChatBotConfig,
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

// MessageStream — 기존 코드 그대로
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

// EventPump — 기존 코드 그대로
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
```

Key changes vs old code:
- `@injectable()` class → plain factory function
- `sessions` Map 제거 — 1 인스턴스 = 1 세션
- 팩토리가 init 이벤트를 await → sessionId 즉시 사용 가능
- `chat()`에서 session lookup 제거 — 항상 같은 세션
- `setSystemPrompt()`, `setMcpServers()` 제거 — config로 팩토리에 전달

- [ ] **Step 2: Run type check (expect fail on index.ts, brain)**

Run: `bunx tsc -p libs/llm/tsconfig.json --noEmit`

- [ ] **Step 3: Commit**

```bash
git add libs/llm/src/claude-code.ts
git commit -m "refactor: ClaudeCodeBot을 단일 세션 팩토리로 변환"
```

---

### Task 3: CodexBot factory

**Files:**
- Rewrite: `libs/llm/src/codex.ts`

- [ ] **Step 1: Rewrite codex.ts**

```typescript
import { randomUUID } from "node:crypto";
import { unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { env } from "@lib/env";
import {
	Codex,
	type Input,
	type Thread,
	type UserInput,
} from "@openai/codex-sdk";
import type {
	ChatAttachment,
	ChatBot,
	ChatBotConfig,
	ChatBotFactory,
	ChatResult,
	McpServerConfig,
} from "./chatbot.js";

type CodexConfigValue =
	| string
	| number
	| boolean
	| CodexConfigValue[]
	| { [key: string]: CodexConfigValue };

function isStdio(
	server: McpServerConfig,
): server is { type?: "stdio"; command: string; args?: string[] } {
	return "command" in server;
}

function buildCodex(
	mcpServers: Record<string, McpServerConfig>,
	systemPrompt?: string,
): Codex {
	const mcpConfig: { [key: string]: CodexConfigValue } = {};
	for (const [name, server] of Object.entries(mcpServers)) {
		if (!isStdio(server)) continue;
		const entry: { command: string; args?: string[] } = {
			command: server.command,
		};
		if (server.args && server.args.length > 0) entry.args = server.args;
		mcpConfig[name] = entry;
	}

	const config: { [key: string]: CodexConfigValue } = {};
	if (Object.keys(mcpConfig).length > 0) config["mcp_servers"] = mcpConfig;
	if (systemPrompt) config["instructions"] = systemPrompt;
	if (Object.keys(config).length === 0) return new Codex();
	return new Codex({ config });
}

async function buildInput(
	message: string,
	attachments?: ChatAttachment[],
): Promise<{ input: Input; cleanup: () => void }> {
	if (!attachments || attachments.length === 0) {
		return { input: message, cleanup: () => {} };
	}

	const parts: UserInput[] = [];
	const tempFiles: string[] = [];

	for (const att of attachments) {
		if (att.contentType.startsWith("image/")) {
			try {
				const res = await fetch(att.url);
				const buf = Buffer.from(await res.arrayBuffer());
				const ext = att.filename.split(".").pop() ?? "jpg";
				const path = join(tmpdir(), `codex-img-${randomUUID()}.${ext}`);
				writeFileSync(path, buf);
				tempFiles.push(path);
				parts.push({ type: "local_image", path });
			} catch {
				parts.push({
					type: "text",
					text: `[Image unavailable: ${att.filename}]`,
				});
			}
		} else {
			parts.push({
				type: "text",
				text: `[File: ${att.filename} (${att.url})]`,
			});
		}
	}

	if (message) parts.push({ type: "text", text: message });

	return {
		input: parts,
		cleanup: () => {
			for (const f of tempFiles) {
				try { unlinkSync(f); } catch { /* already deleted */ }
			}
		},
	};
}

export const createCodexBot: ChatBotFactory = async (config, resume) => {
	const codex = buildCodex(config.mcpServers, config.systemPrompt);
	const model = env("CODEX_MODEL", "");
	const effort = env("CODEX_EFFORT", "high");

	let thread: Thread;
	if (resume) {
		thread = codex.resumeThread(resume);
	} else {
		thread = codex.startThread({
			approvalPolicy: "never",
			...(model && { model }),
			modelReasoningEffort: effort as
				| "minimal"
				| "low"
				| "medium"
				| "high"
				| "xhigh",
		});
	}

	let sessionId = resume ?? "";
	let lock: Promise<void> | null = null;

	const bot: ChatBot = {
		get sessionId() {
			return sessionId;
		},

		interrupt() {
			// Codex는 one-shot 응답 — interrupt 불가, no-op
		},

		chat(message: string, attachments?: ChatAttachment[]): ChatResult {
			const responseStream = async function* () {
				// 이전 요청 완료 대기 (Codex는 one-shot이라 interrupt 대신 직렬화)
				if (lock) await lock.catch(() => {});

				let resolve: (() => void) | undefined;
				lock = new Promise<void>((r) => {
					resolve = r;
				});

				const { input, cleanup } = await buildInput(message, attachments);
				try {
					const { events } = await thread.runStreamed(input);
					const seen = new Map<string, number>();

					for await (const event of events) {
						if (event.type === "thread.started") {
							sessionId = event.thread_id;
						}
						if (
							(event.type === "item.updated" ||
								event.type === "item.completed") &&
							event.item.type === "agent_message"
						) {
							const prev = seen.get(event.item.id) ?? 0;
							const text = event.item.text;
							if (text.length > prev) {
								yield { type: "text" as const, text: text.slice(prev) };
								seen.set(event.item.id, text.length);
							}
						}
					}
				} finally {
					cleanup();
					resolve?.();
					lock = null;
				}
			};

			return { stream: responseStream() };
		},
	};

	return bot;
};
```

- [ ] **Step 2: Commit**

```bash
git add libs/llm/src/codex.ts
git commit -m "refactor: CodexBot을 단일 세션 팩토리로 변환"
```

---

### Task 4: Update llm exports

**Files:**
- Modify: `libs/llm/src/index.ts`

- [ ] **Step 1: Update exports**

```typescript
export type {
	ChatAttachment,
	ChatBot,
	ChatBotConfig,
	ChatBotFactory,
	ChatResult,
	McpServerConfig,
	StreamChunk,
} from "./chatbot.js";
export { createClaudeCodeBot } from "./claude-code.js";
export { createCodexBot } from "./codex.js";
```

- [ ] **Step 2: Run type check on llm**

Run: `bunx tsc -p libs/llm/tsconfig.json --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add libs/llm/src/index.ts
git commit -m "refactor: llm exports에서 DI 토큰, 클래스 제거"
```

---

### Task 5: Remove DI decorators from platform

**Files:**
- Modify: `libs/chat-platform/src/platform.ts`
- Modify: `libs/chat-platform/src/discord.ts`
- Modify: `libs/chat-platform/src/telegram.ts`

- [ ] **Step 1: platform.ts에서 PLATFORM_TOKEN 제거**

`PLATFORM_TOKEN` export 제거. 나머지는 그대로.

- [ ] **Step 2: discord.ts에서 `@injectable()`, tsyringe import 제거**

```typescript
// 삭제: import { injectable } from "tsyringe";
// 삭제: @injectable()
export class DiscordPlatform extends ChatPlatform {
```

- [ ] **Step 3: telegram.ts에서 동일하게 제거**

- [ ] **Step 4: Run type check**

Run: `bunx tsc -p libs/chat-platform/tsconfig.json --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add libs/chat-platform/src/
git commit -m "refactor: chat-platform에서 DI 데코레이터 제거"
```

---

### Task 6: Fix mcp-discovery import

**Files:**
- Modify: `libs/mcp-discovery/src/index.ts`

`McpServerConfig`를 `@lib/llm`에서 가져오고 있는데, 이제 `@lib/llm`이 type-only export. 임포트 경로 확인 후 변경 없으면 skip.

- [ ] **Step 1: 현재 import 확인 후 필요시 수정**

`@lib/llm`에서 `McpServerConfig` 타입이 여전히 export되므로 변경 불필요할 수 있음. 타입 체크로 확인.

Run: `bunx tsc -p libs/mcp-discovery/tsconfig.json --noEmit`

- [ ] **Step 2: Commit (변경 있을 경우만)**

---

### Task 7: ChannelWorker 구현

**Files:**
- Create: `apps/brain/src/channel-worker.ts`

- [ ] **Step 1: Create channel-worker.ts**

```typescript
import type { ChatBot, ChatBotConfig, ChatBotFactory } from "@lib/llm";
import type { ChatPlatform, IncomingMessage } from "@lib/chat-platform";
import type { SessionStore } from "@lib/session-store";

export class ChannelWorker {
	private bot: ChatBot | null = null;
	private botReady: Promise<void>;
	private pending: IncomingMessage | null = null;
	private draining = false;

	constructor(
		private channelId: string,
		private platform: ChatPlatform,
		private sessions: SessionStore,
		private systemPrompt: string,
		factory: ChatBotFactory,
		config: ChatBotConfig,
		resumeSessionId?: string,
	) {
		this.botReady = factory(config, resumeSessionId).then((b) => {
			this.bot = b;
		});
	}

	enqueue(msg: IncomingMessage): void {
		this.pending = msg;
		if (this.bot) this.bot.interrupt();
		if (!this.draining) this.drain();
	}

	private async drain(): Promise<void> {
		this.draining = true;
		await this.botReady;
		while (this.pending) {
			const msg = this.pending;
			this.pending = null;
			await this.process(msg);
		}
		this.draining = false;
	}

	private async process(msg: IncomingMessage): Promise<void> {
		if (!this.bot) return;

		const history = await this.platform.fetchHistory(this.channelId, 30);

		// fetchHistory 중 새 메시지가 왔으면 이 메시지는 버림
		if (this.pending) return;

		const historyText = history
			.map(
				(h) =>
					`${h.username}(${h.userId})${h.isSelf ? "[너]" : ""}: ${h.text}`,
			)
			.join("\n");
		const meta = Object.entries(msg.metadata)
			.filter(([, v]) => v)
			.map(([k, v]) => `${k}: ${v}`)
			.join(", ");
		const context = `[channelId: ${this.channelId}, userId: ${msg.userId}, username: ${msg.username}${meta ? `, ${meta}` : ""}]`;
		const fullMessage = historyText
			? `<recent_chat_history>\n${historyText}\n</recent_chat_history>\n${context}\n${msg.text}`
			: `${context}\n${msg.text}`;

		const chat = this.bot.chat(
			fullMessage,
			msg.attachments.length > 0
				? msg.attachments.map((a) => ({
						url: a.url,
						filename: a.filename,
						contentType: a.contentType,
						size: a.size,
					}))
				: undefined,
		);

		await this.platform.sendStream(this.channelId, chat.stream);

		if (this.bot.sessionId) {
			this.sessions.set(this.channelId, this.bot.sessionId);
		}
	}
}
```

Key design:
- `enqueue()`: pending에 최신 메시지만 보관 + 즉시 interrupt + drain 시작
- `drain()`: botReady 대기 → pending이 없을 때까지 process
- `process()`: fetchHistory → (superseded 체크) → chat → sendStream → persist sessionId
- `chat()`이 내부적으로 `pump.reset()` + `query.interrupt()` 호출 → 이전 sendStream의 generator가 null 받고 종료 → 이전 process()의 await sendStream이 풀림 → drain 루프가 다음 pending 처리

- [ ] **Step 2: Commit**

```bash
git add apps/brain/src/channel-worker.ts
git commit -m "feat: ChannelWorker — 채널별 봇 + 큐 + interrupt 관리"
```

---

### Task 8: Brain 재작성

**Files:**
- Rewrite: `apps/brain/src/index.ts`

- [ ] **Step 1: Rewrite brain index.ts**

```typescript
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DiscordPlatform } from "@lib/chat-platform";
import { env, findWorkspaceRoot } from "@lib/env";
import {
	type ChatBotConfig,
	type ChatBotFactory,
	createClaudeCodeBot,
	createCodexBot,
} from "@lib/llm";
import { discoverMcpServers } from "@lib/mcp-discovery";
import { Scheduler } from "@lib/scheduler";
import { SessionStore } from "@lib/session-store";
import { ChannelWorker } from "./channel-worker.js";

const dataDir = findWorkspaceRoot();
const platform = new DiscordPlatform();
const sessions = new SessionStore(join(dataDir, "sessions.db"), "claude-code");
const scheduler = new Scheduler(join(dataDir, "scheduler.db"));

await platform.start();

const mcpServers = discoverMcpServers();
const persona = readFileSync(join(dataDir, "PERSONA.md"), "utf-8");
const systemPrompt = `${persona}

응답 시스템 규칙 (절대 위반 금지)
- 너의 텍스트 응답은 자동으로 현재 대화 채널에 전송된다. send_message 도구로 현재 채널에 응답하지 마라.
- <recent_chat_history>는 참고용 맥락이다. 이미 처리된 대화이므로 여기에 응답하지 마라. 새 메시지에만 응답한다.`;

const botType = env("BOT_TYPE", "claude-code");
const factory: ChatBotFactory =
	botType === "codex" ? createCodexBot : createClaudeCodeBot;
const botConfig: ChatBotConfig = { systemPrompt, mcpServers };

console.log(`Bot: ${botType}`);
console.log(`MCP: ${Object.keys(mcpServers).join(", ") || "none"}`);
console.log(`Sessions restored: ${sessions.all().length}`);

// 스케줄러: 전용 봇 인스턴스 사용
const schedulerBot = await factory(botConfig);
scheduler.start(async (schedule) => {
	const chat = schedulerBot.chat(schedule.prompt);
	for await (const _ of chat.stream) {
		// AI 응답 텍스트는 무시 — 도구로 직접 행동
	}
});
console.log(`Scheduler started with ${scheduler.list().length} schedule(s).`);

// 채널별 워커
const workers = new Map<string, ChannelWorker>();

platform.onMessage((msg) => {
	let worker = workers.get(msg.channelId);
	if (!worker) {
		const resumeId = sessions.get(msg.channelId);
		worker = new ChannelWorker(
			msg.channelId,
			platform,
			sessions,
			systemPrompt,
			factory,
			botConfig,
			resumeId,
		);
		workers.set(msg.channelId, worker);
	}
	worker.enqueue(msg);
});

const shutdown = async () => {
	console.log("Shutting down...");
	scheduler.stop();
	sessions.close();
	await platform.stop();
	process.exit(0);
};

process.on("SIGINT", () => {
	void shutdown();
});
process.on("SIGTERM", () => {
	void shutdown();
});

console.log("Brain started.");
```

Key changes:
- `tsyringe` 완전 제거 — `new DiscordPlatform()` 직접 생성
- `reflect-metadata` import 제거
- `BOT_TYPE` env로 팩토리 선택
- `onMessage` handler: 동기 함수 (async X) — 그냥 `worker.enqueue(msg)` 호출만
- 스케줄러: 전용 봇 인스턴스 (채널 워커와 분리)

- [ ] **Step 2: Remove tsyringe from dependencies**

`apps/brain/package.json`에서 tsyringe dependency가 있다면 제거. (tsyringe가 root에 있을 수도 있음 — 확인 필요)

- [ ] **Step 3: Run full type check**

Run: `bunx tsc -p apps/brain/tsconfig.json --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/brain/src/index.ts apps/brain/src/channel-worker.ts
git commit -m "refactor: brain을 ChannelWorker 기반으로 재작성, DI 제거"
```

---

### Task 9: Cleanup — remove tsyringe dependency

**Files:**
- Modify: root `package.json` or relevant package.json files

- [ ] **Step 1: Find and remove tsyringe references**

```bash
grep -r "tsyringe" --include="package.json" .
grep -r "reflect-metadata" --include="package.json" .
grep -r "reflect-metadata" --include="*.ts" .
```

모든 `tsyringe`, `reflect-metadata` 참조 제거. `bun install` 실행.

- [ ] **Step 2: Run full type check on all packages**

```bash
bunx tsc -p apps/brain/tsconfig.json --noEmit
bunx tsc -p libs/llm/tsconfig.json --noEmit
bunx tsc -p libs/chat-platform/tsconfig.json --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: tsyringe, reflect-metadata 의존성 제거"
```

---

### Task 10: Manual smoke test

- [ ] **Step 1: `bun dev`로 brain 실행**

```bash
cd apps/brain && bun dev
```

Expected output:
```
Bot: claude-code
MCP: creatrip-internal, discord, scheduler
Sessions restored: N
Scheduler started with N schedule(s).
Brain started.
```

- [ ] **Step 2: Discord에서 테스트**

1. 단일 메시지 → 정상 응답
2. 빠르게 두 메시지 → 첫 응답 interrupt, 두 번째만 응답
3. tool 호출 중 interrupt → 이전 응답 중단, 새 응답 시작

- [ ] **Step 3: Final commit + push**

```bash
git push
```
