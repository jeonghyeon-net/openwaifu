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

	async sendStream(channelId: string, stream: AsyncIterable<string>) {
		const channel = await this.client.channels.fetch(channelId);
		if (!channel?.isTextBased()) return;

		const textChannel = channel as TextChannel;
		const MESSAGE_LIMIT = 2000;
		const CHUNK_THRESHOLD = 1800;

		const state = {
			buffer: "",
			msg: null as Awaited<ReturnType<TextChannel["send"]>> | null,
		};

		// 첫 메시지 전까지 typing 유지
		await textChannel.sendTyping();
		const typingInterval = setInterval(() => {
			if (!state.msg) textChannel.sendTyping();
		}, 5000);

		try {
			for await (const chunk of stream) {
				state.buffer += chunk;

				if (state.buffer.length > CHUNK_THRESHOLD && state.msg) {
					await state.msg.edit(state.buffer.slice(0, MESSAGE_LIMIT));
					state.msg = null;
					state.buffer = state.buffer.slice(MESSAGE_LIMIT);
				}

				if (!state.msg) {
					clearInterval(typingInterval);
					state.msg = await textChannel.send(state.buffer);
				} else {
					try {
						await state.msg.edit(state.buffer);
					} catch {
						state.msg = await textChannel.send(state.buffer);
					}
				}
			}

			if (state.msg && state.buffer) {
				try {
					await state.msg.edit(state.buffer);
				} catch {
					await textChannel.send(state.buffer);
				}
			} else if (!state.msg && state.buffer) {
				await textChannel.send(state.buffer);
			}
		} finally {
			clearInterval(typingInterval);
		}
	}
}
