export type Attachment = {
	url: string;
	filename: string;
	contentType: string;
	size: number;
};

export type HistoryMessage = {
	userId: string;
	username: string;
	text: string;
	isSelf: boolean;
};

export type IncomingMessage = {
	channelId: string;
	userId: string;
	username: string;
	text: string;
	metadata: Record<string, string>;
	attachments: Attachment[];
};

export type MessageHandler = (msg: IncomingMessage) => void | Promise<void>;

export abstract class ChatPlatform {
	abstract start(): Promise<void>;
	abstract stop(): Promise<void>;
	abstract onMessage(handler: MessageHandler): void;
	abstract setStatus(text: string): void;
	abstract sendStream(
		channelId: string,
		stream: AsyncIterable<{ type: "text"; text: string }>,
	): Promise<void>;
	abstract fetchHistory(
		channelId: string,
		limit: number,
	): Promise<HistoryMessage[]>;
}
