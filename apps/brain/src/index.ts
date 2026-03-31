import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
	DiscordPlatform,
	type HistoryMessage,
	type IncomingMessage,
	TelegramPlatform,
} from "@lib/chat-platform";
import { env, findWorkspaceRoot } from "@lib/env";
import { Bot, type BotType, ClaudeCodeBot, CodexBot } from "@lib/llm";
import { discoverMcpServers } from "@lib/mcp-discovery";
import { Scheduler } from "@lib/scheduler";
import { SessionStore } from "@lib/session-store";
import { formatStats, getSystemStats } from "@lib/system-monitor";

// 설정
const dataDir = findWorkspaceRoot();
const botType = env("BOT_TYPE", "claude-code");
const pluginDirs = [dataDir];
const botImpl: BotType = botType === "codex" ? CodexBot : ClaudeCodeBot;
const mcpServers = discoverMcpServers();
const persona = readFileSync(join(dataDir, "PERSONA.md"), "utf-8");
const chatPrompt = `${persona}

응답 시스템 규칙 (절대 위반 금지)
- 너의 텍스트 응답은 자동으로 현재 대화 채널에 전송된다. 현재 대화 채널(channelId)로는 send_message를 절대 호출하지 마라. send_message는 현재 채널이 아닌 다른 채널에 메시지를 보낼 때만 사용한다. 이 규칙을 어기면 메시지가 중복 전송된다.
- <recent_chat_history>는 참고용 맥락이다. 이미 처리된 대화이므로 여기에 응답하지 마라. 새 메시지에만 응답한다.`;

// 인프라
const platform =
	env("PLATFORM", "discord") === "telegram"
		? new TelegramPlatform()
		: new DiscordPlatform();
const sessions = new SessionStore(join(dataDir, "sessions.db"), botType);
const scheduler = new Scheduler(join(dataDir, "scheduler.db"));

// 스케줄러
const schedulerBot = Bot.create(botImpl, {
	systemPrompt: persona,
	mcpServers,
	resume: undefined,
	pluginDirs,
});
scheduler.start(async (schedule) => {
	for await (const _ of schedulerBot.send(schedule.prompt)) {
		// 도구로 직접 행동
	}
});

// 채널별 봇
const bots = new Map<string, Bot>();
const pending = new Map<string, Promise<Bot>>();

function createBot(channelId: string): Bot {
	const bot = Bot.create(botImpl, {
		systemPrompt: chatPrompt,
		mcpServers,
		resume: sessions.get(channelId),
		pluginDirs,
	});
	bots.set(channelId, bot);
	return bot;
}

function getBot(channelId: string): Promise<Bot> {
	const p = pending.get(channelId);
	if (p) return p;

	const promise = (async () => {
		const existing = bots.get(channelId);
		if (!existing) return createBot(channelId);

		const usage = await existing.contextUsage();
		if (usage >= 80) {
			console.log(`Context ${usage}% — resetting [${channelId}]`);
			existing.destroy();
			bots.delete(channelId);
			sessions.delete(channelId);
			return createBot(channelId);
		}

		return existing;
	})();

	pending.set(channelId, promise);
	promise.finally(() => pending.delete(channelId));
	return promise;
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
	const now = new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
	const context = `[channelId: ${msg.channelId}, userId: ${msg.userId}, username: ${msg.username}${meta ? `, ${meta}` : ""}]`;
	return historyText
		? `<recent_chat_history>\n${historyText}\n</recent_chat_history>\n[${now}]\n${context}\n${msg.text}`
		: `[${now}]\n${context}\n${msg.text}`;
}

platform.onMessage(async (msg) => {
	const bot = await getBot(msg.channelId);
	const history = await platform.fetchHistory(msg.channelId, 30);

	try {
		await platform.sendStream(
			msg.channelId,
			bot.send(buildMessage(msg, history), msg.attachments),
		);
	} catch (err) {
		console.error(`sendStream error [${msg.channelId}]:`, err);
		bot.destroy();
		bots.delete(msg.channelId);
		sessions.delete(msg.channelId);
		return;
	}

	if (bot.sessionId) {
		sessions.set(msg.channelId, bot.sessionId);
	}
});

// 플랫폼 시작 (핸들러 등록 후)
await platform.start();

console.log(`Bot: ${botType}`);
console.log(`MCP: ${Object.keys(mcpServers).join(", ") || "none"}`);
console.log(`Sessions: ${sessions.all().length}`);
console.log(`Schedules: ${scheduler.list().length}`);
console.log("Brain started.");

const statusTimer = setInterval(
	() => platform.setStatus(formatStats(getSystemStats())),
	30_000,
);
platform.setStatus(formatStats(getSystemStats()));

// 종료
const shutdown = async () => {
	console.log("Shutting down...");
	clearInterval(statusTimer);
	schedulerBot.destroy();
	for (const bot of bots.values()) bot.destroy();
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
