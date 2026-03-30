import { env } from "@lib/env";
import { Bot } from "grammy";
import { injectable } from "tsyringe";
import {
	type Attachment,
	ChatPlatform,
	type IncomingMessage,
	type MessageHandler,
} from "./platform.js";

@injectable()
export class TelegramPlatform extends ChatPlatform {
	private bot: Bot | null = null;
	private handlers: MessageHandler[] = [];

	onMessage(handler: MessageHandler) {
		this.handlers.push(handler);
	}

	private dispatch(msg: IncomingMessage) {
		for (const handler of this.handlers) {
			Promise.resolve(handler(msg)).catch((e: unknown) => {
				console.error("Message handler error:", e);
			});
		}
	}

	private buildBase(ctx: {
		chat: { id: number; type: string };
		from: { id: number; username?: string; first_name: string };
	}): Omit<IncomingMessage, "text" | "attachments"> {
		return {
			channelId: String(ctx.chat.id),
			userId: String(ctx.from.id),
			username: ctx.from.username ?? ctx.from.first_name,
			metadata: {
				chatType: ctx.chat.type,
				chatTitle: String(
					(ctx.chat as { title?: string | undefined }).title ?? "",
				),
			},
		};
	}

	private async resolveFileUrl(
		bot: Bot,
		fileId: string,
		token: string,
	): Promise<string> {
		const file = await bot.api.getFile(fileId);
		return `https://api.telegram.org/file/bot${token}/${file.file_path}`;
	}

	async start() {
		const token = env("TELEGRAM_TOKEN");
		this.bot = new Bot(token);
		const bot = this.bot;

		bot.on("message:text", (ctx) => {
			this.dispatch({
				...this.buildBase(ctx),
				text: ctx.message.text,
				attachments: [],
			});
		});

		bot.on("message:photo", async (ctx) => {
			const photos = ctx.message.photo;
			const largest = photos[photos.length - 1];
			if (!largest) return;
			const url = await this.resolveFileUrl(bot, largest.file_id, token);
			const attachment: Attachment = {
				url,
				filename: "photo.jpg",
				contentType: "image/jpeg",
				size: largest.file_size ?? 0,
			};
			this.dispatch({
				...this.buildBase(ctx),
				text: ctx.message.caption ?? "",
				attachments: [attachment],
			});
		});

		bot.on("message:document", async (ctx) => {
			const doc = ctx.message.document;
			const url = await this.resolveFileUrl(bot, doc.file_id, token);
			const attachment: Attachment = {
				url,
				filename: doc.file_name ?? "document",
				contentType: doc.mime_type ?? "application/octet-stream",
				size: doc.file_size ?? 0,
			};
			this.dispatch({
				...this.buildBase(ctx),
				text: ctx.message.caption ?? "",
				attachments: [attachment],
			});
		});

		bot.start();
	}

	async stop() {
		if (this.bot) await this.bot.stop();
	}

	async fetchHistory() {
		// Telegram Bot API does not support fetching chat history
		return [];
	}

	async sendStream(channelId: string, stream: AsyncIterable<string>) {
		if (!this.bot) throw new Error("Bot not started yet");
		const bot = this.bot;
		const chatId = Number(channelId);
		const MESSAGE_LIMIT = 4096;
		const CHUNK_THRESHOLD = 3800;

		let buffer = "";
		let msgId: number | null = null;

		const editSafe = async (id: number, text: string) => {
			try {
				await bot.api.editMessageText(chatId, id, text);
			} catch (e: unknown) {
				const m = e instanceof Error ? e.message : String(e);
				if (!m.includes("message is not modified")) throw e;
			}
		};

		await bot.api.sendChatAction(chatId, "typing");
		const typingInterval = setInterval(() => {
			if (!msgId) bot.api.sendChatAction(chatId, "typing");
		}, 4000);

		try {
			for await (const chunk of stream) {
				buffer += chunk;

				if (buffer.length > CHUNK_THRESHOLD && msgId) {
					await editSafe(msgId, buffer.slice(0, MESSAGE_LIMIT));
					msgId = null;
					buffer = buffer.slice(MESSAGE_LIMIT);
				}

				if (!msgId) {
					clearInterval(typingInterval);
					const sent = await bot.api.sendMessage(chatId, buffer);
					msgId = sent.message_id;
				} else {
					await editSafe(msgId, buffer);
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
