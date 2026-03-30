import "reflect-metadata";
import {
	type ChatPlatform,
	DiscordPlatform,
	PLATFORM_TOKEN,
} from "@lib/chat-platform";
import { CHATBOT_TOKEN, type ChatBot, CodexBot } from "@lib/llm";
import { discoverMcpServers } from "@lib/mcp-discovery";
import { SessionStore } from "@lib/session-store";
import { container } from "tsyringe";

container.register(CHATBOT_TOKEN, { useClass: CodexBot });
container.register(PLATFORM_TOKEN, { useClass: DiscordPlatform });

const bot = container.resolve<ChatBot>(CHATBOT_TOKEN);
const platform = container.resolve<ChatPlatform>(PLATFORM_TOKEN);
const sessions = new SessionStore("sessions.db", bot.name);

await platform.start();

const standaloneMcp = discoverMcpServers();
bot.setMcpServers(() => ({
	...standaloneMcp,
	...platform.createMcpServer(),
}));

console.log(
	`MCP: ${Object.keys(standaloneMcp).join(", ") || "none"} + platform`,
);
console.log(`Sessions restored: ${sessions.all().length}`);

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
