export const PLATFORM_TOKEN = "ChatPlatform";

export type IncomingMessage = {
	channelId: string;
	userId: string;
	text: string;
};

export type MessageHandler = (msg: IncomingMessage) => void;

export abstract class ChatPlatform {
	abstract start(): Promise<void>;
	abstract stop(): Promise<void>;
	abstract onMessage(handler: MessageHandler): void;
	abstract sendStream(
		channelId: string,
		stream: AsyncIterable<string>,
	): Promise<void>;
}
