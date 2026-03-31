import type { McpServerConfig as AgentMcpServerConfig } from "@anthropic-ai/claude-agent-sdk";

export type McpServerConfig = AgentMcpServerConfig;

export type ChatAttachment = {
	url: string;
	filename: string;
	contentType: string;
	size: number;
};

export type StreamChunk = { type: "text"; text: string };

export type ChatBotConfig = {
	systemPrompt: string;
	mcpServers: Record<string, McpServerConfig>;
};

/** ChatBot 클래스의 static side 타입. `await Provider.create(config)` 패턴에 사용. */
export interface ChatBotClass {
	create(config: ChatBotConfig, resume?: string): Promise<ChatBot>;
}

export abstract class ChatBot {
	abstract readonly sessionId: string;
	/** 메시지 전송. 이전 응답이 진행 중이면 자동 interrupt 후 새 응답 스트림 리턴. */
	abstract enqueue(
		message: string,
		attachments?: ChatAttachment[],
	): AsyncIterable<StreamChunk>;
}
