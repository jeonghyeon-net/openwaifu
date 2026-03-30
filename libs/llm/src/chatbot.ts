export const CHATBOT_TOKEN = "ChatBot";

export type McpServerConfig = {
	command: string;
	args: string[];
};

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
	abstract chat(message: string, options?: ChatOptions): ChatResult;
	abstract setMcpServers(
		servers: Record<string, McpServerConfig>,
		sessionId?: string,
	): Promise<void>;
}
