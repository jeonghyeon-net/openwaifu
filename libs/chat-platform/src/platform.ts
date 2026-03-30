import type { McpServerConfig } from "@lib/llm";

export const PLATFORM_TOKEN = "ChatPlatform";

export type IncomingMessage = {
	channelId: string;
	userId: string;
	text: string;
};

export type MessageHandler = (msg: IncomingMessage) => void | Promise<void>;

export abstract class ChatPlatform {
	abstract start(): Promise<void>;
	abstract stop(): Promise<void>;
	abstract onMessage(handler: MessageHandler): void;
	abstract sendStream(
		channelId: string,
		stream: AsyncIterable<string>,
	): Promise<void>;
	/**
	 * Factory that creates a fresh MCP server instance per call.
	 * Each session needs its own instance — they cannot be shared.
	 */
	abstract createMcpServer(): Record<string, McpServerConfig>;
}
