import "reflect-metadata";
import { CHATBOT_TOKEN, type ChatBot, ClaudeCodeBot } from "@lib/llm";
import { discoverMcpServers } from "@lib/mcp-discovery";
import { container } from "tsyringe";

container.register(CHATBOT_TOKEN, { useClass: ClaudeCodeBot });

const bot = container.resolve<ChatBot>(CHATBOT_TOKEN);
const mcpServers = discoverMcpServers();

console.log(`MCP: ${Object.keys(mcpServers).join(", ") || "none"}`);

const chat = bot.chat("안녕!");

for await (const chunk of chat.stream) {
	process.stdout.write(chunk);
}
console.log();

if (chat.sessionId && Object.keys(mcpServers).length > 0) {
	await bot.setMcpServers(mcpServers, chat.sessionId);
}
