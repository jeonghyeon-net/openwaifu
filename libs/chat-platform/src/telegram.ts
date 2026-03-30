import { env } from "@lib/env";
import { Bot } from "grammy";
import { injectable } from "tsyringe";
import { ChatPlatform, type MessageHandler } from "./platform.js";

@injectable()
export class TelegramPlatform extends ChatPlatform {
	private bot: Bot | null = null;
	private handlers: MessageHandler[] = [];

	onMessage(handler: MessageHandler) {
		this.handlers.push(handler);
	}

	async start() {
		this.bot = new Bot(env("TELEGRAM_TOKEN"));

		this.bot.on("message:text", (ctx) => {
			for (const handler of this.handlers) {
				Promise.resolve(
					handler({
						channelId: String(ctx.chat.id),
						userId: String(ctx.from.id),
						text: ctx.message.text,
					}),
				).catch((e: unknown) => {
					console.error("Message handler error:", e);
				});
			}
		});

		this.bot.start();
	}

	async stop() {
		if (this.bot) await this.bot.stop();
	}

	async sendStream(channelId: string, stream: AsyncIterable<string>) {
		if (!this.bot) throw new Error("Bot not started yet");
		const bot = this.bot;
		const chatId = Number(channelId);
		const MESSAGE_LIMIT = 4096;
		const CHUNK_THRESHOLD = 3800;
		const EDIT_INTERVAL_MS = 1000;

		await bot.api.sendChatAction(chatId, "typing");
		const typingInterval = setInterval(() => {
			bot.api.sendChatAction(chatId, "typing");
		}, 4000);

		let buffer = "";
		let msgId: number | null = null;
		let lastEditTime = 0;

		const editSafe = async (id: number, text: string) => {
			try {
				await bot.api.editMessageText(chatId, id, text);
			} catch (e: unknown) {
				const msg = e instanceof Error ? e.message : String(e);
				if (!msg.includes("message is not modified")) throw e;
			}
		};

		try {
			for await (const chunk of stream) {
				buffer += chunk;

				if (buffer.length > CHUNK_THRESHOLD && msgId) {
					await editSafe(msgId, buffer.slice(0, MESSAGE_LIMIT));
					msgId = null;
					buffer = buffer.slice(MESSAGE_LIMIT);
				}

				if (!msgId) {
					const sent = await bot.api.sendMessage(chatId, buffer);
					msgId = sent.message_id;
					lastEditTime = Date.now();
				} else if (Date.now() - lastEditTime >= EDIT_INTERVAL_MS) {
					await editSafe(msgId, buffer);
					lastEditTime = Date.now();
				}
			}

			if (msgId && buffer) {
				await editSafe(msgId, buffer);
			} else if (!msgId && buffer) {
				await bot.api.sendMessage(chatId, buffer);
			}
		} finally {
			clearInterval(typingInterval);
		}
	}
}
