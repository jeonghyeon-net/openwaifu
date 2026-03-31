/** MCP 서버 설정 (stdio). SDK별 타입과 구조적으로 호환. */
export type McpServerConfig = { command: string; args?: string[] };

export type Attachment = {
	url: string;
	filename: string;
	contentType: string;
	size: number;
};

export type StreamChunk =
	| { type: "text"; text: string }
	| { type: "image"; data: Buffer; mediaType: string };

export type BotConfig = {
	systemPrompt: string;
	mcpServers: Record<string, McpServerConfig>;
	resume: string | undefined;
	pluginDirs: string[];
};

export type BotType = new (config: BotConfig) => Bot;

export abstract class Bot {
	abstract readonly sessionId: string;
	/** 컨텍스트 사용률 (0~100). 미지원 시 0. */
	async contextUsage(): Promise<number> {
		return 0;
	}
	/** 리소스 정리. */
	destroy(): void {}
	/** 메시지 전송. 이전 응답이 진행 중이면 자동 interrupt. */
	abstract send(
		message: string,
		attachments?: Attachment[],
	): AsyncIterable<StreamChunk>;

	/** Bot(ClaudeCodeBot, config) */
	static create(type: BotType, config: BotConfig): Bot {
		return new type(config);
	}
}
