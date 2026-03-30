import type { McpServerConfig as AgentMcpServerConfig } from "@anthropic-ai/claude-agent-sdk";

export const CHATBOT_TOKEN = "ChatBot";

export type McpServerConfig = AgentMcpServerConfig;

export type McpServerFactory = () => Record<string, McpServerConfig>;

export type ChatOptions = {
	sessionId?: string;
};

export type ChatResult = {
	/**
	 * Session ID for this chat. Empty string until the stream emits
	 * its first event. Consume the stream before reading this value.
	 */
	sessionId: string;
	stream: AsyncIterable<string>;
};

export abstract class ChatBot {
	abstract readonly name: string;
	abstract chat(message: string, options?: ChatOptions): ChatResult;
	abstract interrupt(sessionId: string): Promise<void>;
	abstract setMcpServers(factory: McpServerFactory): void;
	abstract setSystemPrompt(prompt: string): void;
}
