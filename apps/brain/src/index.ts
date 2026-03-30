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

await platform.start();

// MCP factory: 매 세션마다 새 인스턴스 생성
const standaloneMcp = discoverMcpServers();
bot.setMcpServers(() => ({
	...standaloneMcp,
	...platform.createMcpServer(),
}));

console.log(
	`MCP: ${Object.keys(standaloneMcp).join(", ") || "none"} + platform`,
);

// 채널/스레드별 세션 관리
const sessions = new Map<string, string>();
const activeChannels = new Set<string>();

platform.onMessage(async (msg) => {
	const sessionId = sessions.get(msg.channelId);

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
