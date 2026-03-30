import "reflect-metadata";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
	type ChatPlatform,
	DiscordPlatform,
	PLATFORM_TOKEN,
} from "@lib/chat-platform";
import { CHATBOT_TOKEN, type ChatBot, ClaudeCodeBot } from "@lib/llm";
import { discoverMcpServers } from "@lib/mcp-discovery";
import { SessionStore } from "@lib/session-store";
import { container } from "tsyringe";

container.register(CHATBOT_TOKEN, { useClass: ClaudeCodeBot });
container.register(PLATFORM_TOKEN, { useClass: DiscordPlatform });

const bot = container.resolve<ChatBot>(CHATBOT_TOKEN);
const platform = container.resolve<ChatPlatform>(PLATFORM_TOKEN);
const sessions = new SessionStore("sessions.db", bot.name);

await platform.start();

const mcpServers = discoverMcpServers();
bot.setMcpServers(() => mcpServers);

const persona = readFileSync(join("..", "..", "PERSONA.md"), "utf-8");
const systemRules = `${persona}

응답 시스템 규칙 (절대 위반 금지)
- 너의 텍스트 응답은 자동으로 현재 대화 채널에 전송된다. send_message 도구로 현재 채널에 응답하지 마라.
- send_message는 현재 대화 채널이 아닌 다른 채널에 메시지를 보낼 때만 사용한다.
- <recent_chat_history>는 참고용 맥락이다. 이미 처리된 대화이므로 여기에 응답하지 마라. 새 메시지에만 응답한다.`;
bot.setSystemPrompt(systemRules);

console.log(`MCP: ${Object.keys(mcpServers).join(", ") || "none"}`);
console.log(`Sessions restored: ${sessions.all().length}`);

const activeChannels = new Set<string>();

platform.onMessage(async (msg) => {
	const sessionId = sessions.get(msg.channelId);

	if (sessionId && activeChannels.has(msg.channelId)) {
		await bot.interrupt(sessionId).catch(() => {});
	}

	const meta = Object.entries(msg.metadata)
		.filter(([, v]) => v)
		.map(([k, v]) => `${k}: ${v}`)
		.join(", ");
	const context = `[channelId: ${msg.channelId}, userId: ${msg.userId}, username: ${msg.username}${meta ? `, ${meta}` : ""}]`;

	// 채널 최근 대화 히스토리를 컨텍스트에 포함
	const history = await platform.fetchHistory(msg.channelId, 30);
	const historyText = history
		.map(
			(h) => `${h.username}(${h.userId})${h.isSelf ? "[너]" : ""}: ${h.text}`,
		)
		.join("\n");
	const fullMessage = historyText
		? `<recent_chat_history>\n${historyText}\n</recent_chat_history>\n${context}\n${msg.text}`
		: `${context}\n${msg.text}`;

	const chat = bot.chat(fullMessage, {
		...(sessionId && { sessionId }),
		...(msg.attachments.length > 0 && { attachments: msg.attachments }),
	});

	activeChannels.add(msg.channelId);
	try {
		await platform.sendStream(msg.channelId, chat.stream);
	} finally {
		activeChannels.delete(msg.channelId);
	}

	if (chat.sessionId) {
		sessions.set(msg.channelId, chat.sessionId);
	}
});

const shutdown = async () => {
	console.log("Shutting down...");
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
