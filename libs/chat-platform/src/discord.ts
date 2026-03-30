import { env } from "@lib/env";
import {
	Client,
	Events,
	GatewayIntentBits,
	type TextChannel,
} from "discord.js";
import { injectable } from "tsyringe";
import { ChatPlatform, type MessageHandler } from "./platform.js";

@injectable()
export class DiscordPlatform extends ChatPlatform {
	private client: Client;
	private handlers: MessageHandler[] = [];

	constructor() {
		super();
		this.client = new Client({
			intents: [
				GatewayIntentBits.Guilds,
				GatewayIntentBits.GuildMessages,
				GatewayIntentBits.MessageContent,
			],
		});

		this.client.on(Events.MessageCreate, (msg) => {
			if (msg.author.bot) return;

			for (const handler of this.handlers) {
				Promise.resolve(
					handler({
						channelId: msg.channelId,
						userId: msg.author.id,
						username: msg.author.username,
						text: msg.content,
						metadata: {
							guildId: msg.guildId ?? "",
							guildName: msg.guild?.name ?? "",
							channelName:
								"name" in msg.channel ? (msg.channel.name ?? "") : "",
						},
						attachments: msg.attachments.map((a) => ({
							url: a.url,
							filename: a.name ?? "unknown",
							contentType: a.contentType ?? "application/octet-stream",
							size: a.size,
						})),
					}),
				).catch((e: unknown) => {
					console.error("Message handler error:", e);
				});
			}
		});
	}

	async start() {
		await this.client.login(env("DISCORD_TOKEN"));
	}

	async stop() {
		await this.client.destroy();
	}

	onMessage(handler: MessageHandler) {
		this.handlers.push(handler);
	}

	async sendStream(channelId: string, stream: AsyncIterable<string>) {
		const channel = await this.client.channels.fetch(channelId);
		if (!channel?.isTextBased()) return;

		const textChannel = channel as TextChannel;
		await textChannel.sendTyping();
		const typingInterval = setInterval(() => {
			textChannel.sendTyping();
		}, 5000);

		const MESSAGE_LIMIT = 2000;
		const CHUNK_THRESHOLD = 1800;
		const EDIT_INTERVAL_MS = 1000;

		let buffer = "";
		let msg: Awaited<ReturnType<TextChannel["send"]>> | null = null;
		let lastEditTime = 0;

		try {
			for await (const chunk of stream) {
				buffer += chunk;

				if (buffer.length > CHUNK_THRESHOLD && msg) {
					await msg.edit(buffer.slice(0, MESSAGE_LIMIT));
					msg = null;
					buffer = buffer.slice(MESSAGE_LIMIT);
				}

				if (!msg) {
					// 첫 메시지 전송 시 typing indicator 중지
					clearInterval(typingInterval);
					msg = await textChannel.send(buffer);
					lastEditTime = Date.now();
				} else if (Date.now() - lastEditTime >= EDIT_INTERVAL_MS) {
					await msg.edit(buffer);
					lastEditTime = Date.now();
				}
			}

			if (msg && buffer) {
				await msg.edit(buffer);
			} else if (!msg && buffer) {
				clearInterval(typingInterval);
				await textChannel.send(buffer);
			}
		} finally {
			clearInterval(typingInterval);
		}
	}
}
