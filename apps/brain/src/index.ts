import "reflect-metadata";
import { CHATBOT_TOKEN, type ChatBot, CodexBot } from "@lib/llm";
import { discoverMcpServers } from "@lib/mcp-discovery";
import { startRepl } from "@lib/repl";
import { container } from "tsyringe";

container.register(CHATBOT_TOKEN, { useClass: CodexBot });

const bot = container.resolve<ChatBot>(CHATBOT_TOKEN);
const mcpServers = discoverMcpServers();

console.log(`MCP: ${Object.keys(mcpServers).join(", ") || "none"}`);

await bot.setMcpServers(mcpServers);
await startRepl(bot);
