import "reflect-metadata";
import { CHATBOT_TOKEN, type ChatBot, ClaudeCodeBot } from "@lib/llm";
import { discoverMcpServers } from "@lib/mcp-discovery";
import { container } from "tsyringe";

container.register(CHATBOT_TOKEN, { useClass: ClaudeCodeBot });

const bot = container.resolve<ChatBot>(CHATBOT_TOKEN);
const mcpServers = discoverMcpServers();

console.log(`MCP: ${Object.keys(mcpServers).join(", ") || "none"}`);

// 채팅 전에 MCP 등록
await bot.setMcpServers(mcpServers);

const chat = bot.chat("greeter mcp 호출해봐!");

for await (const chunk of chat.stream) {
	process.stdout.write(chunk);
}
console.log();
