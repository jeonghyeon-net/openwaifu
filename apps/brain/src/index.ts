import "reflect-metadata";
import {
	type ChatPlatform,
	DiscordPlatform,
	PLATFORM_TOKEN,
} from "@lib/chat-platform";
import { CHATBOT_TOKEN, type ChatBot, ClaudeCodeBot } from "@lib/llm";
import { discoverMcpServers } from "@lib/mcp-discovery";
import { container } from "tsyringe";

container.register(CHATBOT_TOKEN, { useClass: ClaudeCodeBot });
container.register(PLATFORM_TOKEN, { useClass: DiscordPlatform });

const bot = container.resolve<ChatBot>(CHATBOT_TOKEN);
const platform = container.resolve<ChatPlatform>(PLATFORM_TOKEN);

// MCP: standalone servers from mcps/ + in-process platform MCP
const standaloneMcp = discoverMcpServers();
console.log(
	`MCP (standalone): ${Object.keys(standaloneMcp).join(", ") || "none"}`,
);
await bot.setMcpServers(standaloneMcp);

// 채널/스레드별 세션 관리
const sessions = new Map<string, string>();

platform.onMessage(async (msg) => {
	const sessionId = sessions.get(msg.channelId);

	// 진행 중인 응답이 있으면 중단
	if (sessionId) {
		await bot.interrupt(sessionId).catch(() => {});
	}

	const chat = bot.chat(msg.text, sessionId ? { sessionId } : undefined);

	await platform.sendStream(msg.channelId, chat.stream);

	if (chat.sessionId) {
		sessions.set(msg.channelId, chat.sessionId);
	}
});

await platform.start();
console.log("Brain started.");
