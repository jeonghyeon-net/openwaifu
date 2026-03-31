/** MCP 서버 설정 (stdio). SDK별 타입과 구조적으로 호환. */
export type McpServerConfig = { command: string; args?: string[] };

export type Attachment = {
	url: string;
	filename: string;
	contentType: string;
	size: number;
};

export type StreamChunk = { type: "text"; text: string };

export type BotConfig = {
	systemPrompt: string;
	mcpServers: Record<string, McpServerConfig>;
	/** 기존 세션 복원용 ID */
	resume?: string;
};

export abstract class Bot {
	abstract readonly sessionId: string;
	/** 메시지 전송. 이전 응답이 진행 중이면 자동 interrupt. */
	abstract send(
		message: string,
		attachments?: Attachment[],
	): AsyncIterable<StreamChunk>;
}
