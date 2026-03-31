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
const botType = env("BOT_TYPE", "claude-code");
const platform = new DiscordPlatform();
const sessions = new SessionStore(join(dataDir, "sessions.db"), botType);
const scheduler = new Scheduler(join(dataDir, "scheduler.db"));

await platform.start();

const mcpServers = discoverMcpServers();
const persona = readFileSync(join(dataDir, "PERSONA.md"), "utf-8");
const systemPrompt = `${persona}

응답 시스템 규칙 (절대 위반 금지)
- 너의 텍스트 응답은 자동으로 현재 대화 채널에 전송된다. send_message 도구로 현재 채널에 응답하지 마라.
- <recent_chat_history>는 참고용 맥락이다. 이미 처리된 대화이므로 여기에 응답하지 마라. 새 메시지에만 응답한다.`;

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
