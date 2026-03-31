import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
	DiscordPlatform,
	type HistoryMessage,
	type IncomingMessage,
} from "@lib/chat-platform";
import { env, findWorkspaceRoot } from "@lib/env";
import {
	Bot,
	type BotConfig,
	type BotType,
	ClaudeCodeBot,
	CodexBot,
} from "@lib/llm";
import { discoverMcpServers } from "@lib/mcp-discovery";
import { Scheduler } from "@lib/scheduler";
import { SessionStore } from "@lib/session-store";

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

const botImpl: BotType = botType === "codex" ? CodexBot : ClaudeCodeBot;
const baseConfig: BotConfig = { systemPrompt, mcpServers };

console.log(`Bot: ${botType}`);
console.log(`MCP: ${Object.keys(mcpServers).join(", ") || "none"}`);
console.log(`Sessions restored: ${sessions.all().length}`);

// 스케줄러: 전용 봇
const schedulerBot = Bot.create(botImpl, baseConfig);
scheduler.start(async (schedule) => {
	for await (const _ of schedulerBot.send(schedule.prompt)) {
		// 도구로 직접 행동
	}
});
console.log(`Scheduler started with ${scheduler.list().length} schedule(s).`);

// 채널별 봇
const bots = new Map<string, Bot>();

function getBot(channelId: string): Bot {
	const existing = bots.get(channelId);
	if (existing) return existing;

	const resumeId = sessions.get(channelId);
	const bot = Bot.create(
		botImpl,
		resumeId ? { ...baseConfig, resume: resumeId } : baseConfig,
	);
	bots.set(channelId, bot);
	return bot;
}

function buildMessage(msg: IncomingMessage, history: HistoryMessage[]): string {
	const historyText = history
		.map(
			(h) => `${h.username}(${h.userId})${h.isSelf ? "[너]" : ""}: ${h.text}`,
		)
		.join("\n");
	const meta = Object.entries(msg.metadata)
		.filter(([, v]) => v)
		.map(([k, v]) => `${k}: ${v}`)
		.join(", ");
	const context = `[channelId: ${msg.channelId}, userId: ${msg.userId}, username: ${msg.username}${meta ? `, ${meta}` : ""}]`;
	return historyText
		? `<recent_chat_history>\n${historyText}\n</recent_chat_history>\n${context}\n${msg.text}`
		: `${context}\n${msg.text}`;
}

platform.onMessage(async (msg) => {
	const bot = getBot(msg.channelId);
	const history = await platform.fetchHistory(msg.channelId, 30);

	try {
		await platform.sendStream(
			msg.channelId,
			bot.send(
				buildMessage(msg, history),
				msg.attachments.length > 0 ? msg.attachments : undefined,
			),
		);
	} catch (err) {
		console.error(`sendStream error [${msg.channelId}]:`, err);
	}

	if (bot.sessionId) {
		sessions.set(msg.channelId, bot.sessionId);
	}
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
