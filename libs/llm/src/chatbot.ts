export const CHATBOT_TOKEN = "ChatBot";

export type McpServerConfig = {
	command: string;
	args: string[];
};

export type ChatOptions = {
	sessionId?: string;
};

export type ChatResult = {
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
