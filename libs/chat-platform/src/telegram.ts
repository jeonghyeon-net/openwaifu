import { Bot } from "grammy";
import { injectable } from "tsyringe";
import { ChatPlatform, type MessageHandler } from "./platform.js";

@injectable()
export class TelegramPlatform extends ChatPlatform {
	private bot: Bot;
	private handlers: MessageHandler[] = [];

	constructor() {
		super();
		const key = "TELEGRAM_TOKEN";
		const token = process.env[key];
		if (!token) throw new Error("TELEGRAM_TOKEN is required");

		this.bot = new Bot(token);

		this.bot.on("message:text", (ctx) => {
			for (const handler of this.handlers) {
				handler({
					channelId: String(ctx.chat.id),
					userId: String(ctx.from.id),
					text: ctx.message.text,
				});
			}
		});
	}

	async start() {
		this.bot.start();
	}

	async stop() {
		await this.bot.stop();
	}

	onMessage(handler: MessageHandler) {
		this.handlers.push(handler);
	}

	async sendText(channelId: string, text: string) {
		await this.bot.api.sendMessage(Number(channelId), text);
	}

	async sendStream(channelId: string, stream: AsyncIterable<string>) {
		const chatId = Number(channelId);
		await this.bot.api.sendChatAction(chatId, "typing");
		const typingInterval = setInterval(() => {
			this.bot.api.sendChatAction(chatId, "typing");
		}, 4000);

		let buffer = "";
		let msgId: number | null = null;

		try {
			for await (const chunk of stream) {
				buffer += chunk;

				if (!msgId) {
					const sent = await this.bot.api.sendMessage(chatId, buffer);
					msgId = sent.message_id;
				} else if (buffer.length % 100 < chunk.length) {
					await this.bot.api.editMessageText(chatId, msgId, buffer);
				}
			}

			if (msgId && buffer) {
				await this.bot.api.editMessageText(chatId, msgId, buffer);
			} else if (!msgId) {
				await this.bot.api.sendMessage(chatId, buffer || "(empty response)");
			}
		} finally {
			clearInterval(typingInterval);
		}
	}
}
