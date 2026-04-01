import { env } from "@lib/env";
import { Bot } from "grammy";
import {
	type Attachment,
	ChatPlatform,
	type IncomingMessage,
	type MessageHandler,
	type PresenceStatus,
} from "./platform.js";

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

	setStatus(_text: string) {
		// Telegram Bot API does not support bot status
	}

	setPresence(_status: PresenceStatus) {
		// Telegram Bot API does not support bot presence
	}

	async fetchHistory() {
		// Telegram Bot API does not support fetching chat history
		return [];
	}

	async sendStream(
		channelId: string,
		stream: AsyncIterable<{ type: "text"; text: string }>,
	) {
		if (!this.bot) throw new Error("Bot not started yet");
		const bot = this.bot;
		const chatId = Number(channelId);

		let buffer = "";
		let msgId: number | null = null;
		let synced = "";

		await bot.api.sendChatAction(chatId, "typing");

		const sync = async () => {
			if (!msgId || buffer === synced) return;
			synced = buffer;
			try {
				await bot.api.editMessageText(chatId, msgId, buffer);
			} catch (e: unknown) {
				const m = e instanceof Error ? e.message : String(e);
				if (!m.includes("message is not modified")) throw e;
			}
		};

		const editTimer = setInterval(() => sync(), 500);

		try {
			for await (const chunk of stream) {
				buffer += chunk.text;

				if (!msgId) {
					const sent = await bot.api.sendMessage(chatId, buffer);
					msgId = sent.message_id;
					synced = buffer;
				}

				// 4096자 초과 → 현재 메시지 확정, 나머지는 새 메시지로
				if (buffer.length > 4096 && msgId) {
					await sync();
					await bot.api
						.editMessageText(chatId, msgId, buffer.slice(0, 4096))
						.catch(() => {});
					buffer = buffer.slice(4096);
					const sent = await bot.api.sendMessage(chatId, buffer);
					msgId = sent.message_id;
					synced = buffer;
				}
			}

			await sync();
		} finally {
			clearInterval(editTimer);
		}
	}
}
