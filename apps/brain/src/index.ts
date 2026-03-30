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

// MCP: standalone servers from mcps/
const standaloneMcp = discoverMcpServers();
console.log(
	`MCP (standalone): ${Object.keys(standaloneMcp).join(", ") || "none"}`,
);

// 채널/스레드별 세션 관리
const sessions = new Map<string, string>();
const activeChannels = new Set<string>();

platform.onMessage(async (msg) => {
	const sessionId = sessions.get(msg.channelId);

	// 진행 중인 응답이 있으면 중단
	if (sessionId && activeChannels.has(msg.channelId)) {
		await bot.interrupt(sessionId).catch((e: unknown) => {
			console.error("Interrupt failed:", e);
		});
	}

	const chat = bot.chat(msg.text, sessionId ? { sessionId } : undefined);

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

await platform.start();

// Wire in-process platform MCP server after start (needs live client)
const allMcp = { ...standaloneMcp, platform: platform.createMcpServer() };
console.log(`MCP (all): ${Object.keys(allMcp).join(", ")}`);
await bot.setMcpServers(allMcp);

// Graceful shutdown
const shutdown = async () => {
	console.log("Shutting down...");
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
