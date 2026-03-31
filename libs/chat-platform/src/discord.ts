import { env } from "@lib/env";
import {
	ActivityType,
	Client,
	Events,
	GatewayIntentBits,
	type TextChannel,
} from "discord.js";
import { ChatPlatform, type MessageHandler } from "./platform.js";

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

	setStatus(text: string) {
		this.client.user?.setActivity(text, { type: ActivityType.Custom });
	}

	async fetchHistory(channelId: string, limit: number) {
		const channel = await this.client.channels.fetch(channelId);
		if (!channel?.isTextBased()) return [];
		const msgs = await (channel as TextChannel).messages.fetch({ limit });
		const selfId = this.client.user?.id;
		return [...msgs.values()].reverse().map((m) => ({
			userId: m.author.id,
			username: m.author.username,
			text: m.content,
			isSelf: m.author.id === selfId,
		}));
	}

	async sendStream(
		channelId: string,
		stream: AsyncIterable<{ type: "text"; text: string }>,
	) {
		const channel = await this.client.channels.fetch(channelId);
		if (!channel?.isTextBased()) return;
		const ch = channel as TextChannel;

		let buffer = "";
		let msg: Awaited<ReturnType<TextChannel["send"]>> | null = null;
		let synced = "";

		await ch.sendTyping();

		const sync = async () => {
			if (!msg || buffer === synced) return;
			synced = buffer;
			await msg.edit(buffer).catch(() => {});
		};

		const editTimer = setInterval(() => sync(), 500);

		try {
			for await (const chunk of stream) {
				buffer += chunk.text;

				if (!msg && buffer) {
					msg = await ch.send(buffer);
					synced = buffer;
				}

				// 2000자 초과 → 현재 메시지 확정, 나머지는 새 메시지로
				if (buffer.length > 2000 && msg) {
					await sync();
					await msg.edit(buffer.slice(0, 2000)).catch(() => {});
					buffer = buffer.slice(2000);
					msg = await ch.send(buffer);
					synced = buffer;
				}
			}

			await sync();
		} finally {
			clearInterval(editTimer);
		}
	}
}
