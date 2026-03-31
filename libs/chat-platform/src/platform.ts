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
	abstract sendStream(
		channelId: string,
		stream: AsyncIterable<
			string | { type: "text"; text: string } | { type: "message_break" }
		>,
	): Promise<void>;
	abstract fetchHistory(
		channelId: string,
		limit: number,
	): Promise<HistoryMessage[]>;
}
