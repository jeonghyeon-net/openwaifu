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
		const MESSAGE_LIMIT = 2000;
		const CHUNK_THRESHOLD = 1800;
		const EDIT_INTERVAL_MS = 1000;
		const SEND_BUFFER_MS = 200;
		const SEND_MIN_LENGTH = 20;

		const state = {
			buffer: "",
			msg: null as Awaited<ReturnType<TextChannel["send"]>> | null,
			lastEditTime: 0,
			lastChunkTime: 0,
			pendingSend: null as ReturnType<typeof setTimeout> | null,
			sending: false,
		};

		await textChannel.sendTyping();
		const typingInterval = setInterval(() => {
			if (Date.now() - state.lastChunkTime > 500) {
				textChannel.sendTyping();
			}
		}, 3000);

		const doSend = async () => {
			if (state.msg || !state.buffer || state.sending) return;
			state.sending = true;
			if (state.pendingSend) {
				clearTimeout(state.pendingSend);
				state.pendingSend = null;
			}
			state.msg = await textChannel.send(state.buffer);
			state.lastEditTime = Date.now();
			state.sending = false;
		};

		try {
			for await (const chunk of stream) {
				state.lastChunkTime = Date.now();
				state.buffer += chunk;

				if (state.buffer.length > CHUNK_THRESHOLD && state.msg) {
					await state.msg.edit(state.buffer.slice(0, MESSAGE_LIMIT));
					state.msg = null;
					state.buffer = state.buffer.slice(MESSAGE_LIMIT);
				}

				if (!state.msg && !state.sending) {
					if (state.buffer.length >= SEND_MIN_LENGTH) {
						await doSend();
					} else if (!state.pendingSend) {
						state.pendingSend = setTimeout(() => {
							doSend();
						}, SEND_BUFFER_MS);
					}
				} else if (
					state.msg &&
					Date.now() - state.lastEditTime >= EDIT_INTERVAL_MS
				) {
					await state.msg.edit(state.buffer);
					state.lastEditTime = Date.now();
				}
			}

			if (state.pendingSend) clearTimeout(state.pendingSend);
			if (!state.msg && !state.sending) await doSend();
			if (state.msg && state.buffer) {
				await state.msg.edit(state.buffer);
			}
		} finally {
			clearInterval(typingInterval);
			if (state.pendingSend) clearTimeout(state.pendingSend);
		}
	}
}
