import type { McpServerConfig as AgentMcpServerConfig } from "@anthropic-ai/claude-agent-sdk";

export type McpServerConfig = AgentMcpServerConfig;

export type ChatAttachment = {
	url: string;
	filename: string;
	contentType: string;
	size: number;
};

export type StreamChunk = { type: "text"; text: string };

export type ChatResult = {
	stream: AsyncIterable<StreamChunk>;
};

export interface ChatBot {
	readonly sessionId: string;
	chat(message: string, attachments?: ChatAttachment[]): ChatResult;
	interrupt(): void;
}

export type ChatBotConfig = {
	systemPrompt: string;
	mcpServers: Record<string, McpServerConfig>;
};

/** 봇 팩토리. resume가 주어지면 기존 세션 복원, 없으면 새 세션 생성. */
export type ChatBotFactory = (
	config: ChatBotConfig,
	resume?: string,
) => Promise<ChatBot>;
