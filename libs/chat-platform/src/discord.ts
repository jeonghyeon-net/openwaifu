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
				handler({
					channelId: msg.channelId,
					userId: msg.author.id,
					text: msg.content,
				});
			}
		});
	}

	async start() {
		const key = "DISCORD_TOKEN";
		const token = process.env[key];
		if (!token) throw new Error("DISCORD_TOKEN is required");
		await this.client.login(token);
	}

	async stop() {
		await this.client.destroy();
	}

	onMessage(handler: MessageHandler) {
		this.handlers.push(handler);
	}

	getClient(): Client {
		return this.client;
	}

	async sendStream(channelId: string, stream: AsyncIterable<string>) {
		const channel = await this.client.channels.fetch(channelId);
		if (!channel?.isTextBased()) return;

		const textChannel = channel as TextChannel;
		await textChannel.sendTyping();
		const typingInterval = setInterval(() => {
			textChannel.sendTyping();
		}, 5000);

		let buffer = "";
		let msg: Awaited<ReturnType<TextChannel["send"]>> | null = null;

		try {
			for await (const chunk of stream) {
				buffer += chunk;

				if (!msg) {
					msg = await textChannel.send(buffer);
				} else if (buffer.length % 100 < chunk.length) {
					await msg.edit(buffer);
				}
			}

			if (msg) {
				await msg.edit(buffer || "(empty response)");
			} else {
				await textChannel.send(buffer || "(empty response)");
			}
		} finally {
			clearInterval(typingInterval);
		}
	}
}
