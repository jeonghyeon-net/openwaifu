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

		const selfId = this.client.user?.id;
		const toHistory = (m: {
			author: { id: string; username: string };
			content: string;
		}) => ({
			userId: m.author.id,
			username: m.author.username,
			text: m.content,
			isSelf: m.author.id === selfId,
		});

		// 스레드인 경우 부모 채널 히스토리도 포함
		if (channel.isThread()) {
			const parentChannel = channel.parent;

			const [parentMsgs, threadMsgs] = await Promise.all([
				parentChannel && "messages" in parentChannel
					? parentChannel.messages.fetch({ limit }).catch(() => null)
					: Promise.resolve(null),
				channel.messages.fetch({ limit }),
			]);

			const parent = parentMsgs
				? [...parentMsgs.values()].reverse().map(toHistory)
				: [];
			const current = [...threadMsgs.values()].reverse().map(toHistory);
			return [...parent, ...current].slice(-limit);
		}

		const msgs = await (channel as TextChannel).messages.fetch({ limit });
		return [...msgs.values()].reverse().map(toHistory);
	}

	async sendStream(
		channelId: string,
		stream: AsyncIterable<{ type: "text"; text: string }>,
	) {
		const channel = await this.client.channels.fetch(channelId);
		if (!channel?.isTextBased()) return;
		const ch = channel as TextChannel;

		const s = {
			buffer: "",
			msg: null as Awaited<ReturnType<TextChannel["send"]>> | null,
		};

		await ch.sendTyping();

		const flush = async () => {
			if (!s.buffer.trim()) return;
			if (s.msg) {
				await s.msg.edit(s.buffer).catch(() => {});
			} else {
				s.msg = await ch.send(s.buffer);
			}
		};

		const delay = () =>
			new Promise<"tick">((r) => setTimeout(() => r("tick"), 500));
		const iter = stream[Symbol.asyncIterator]();
		let next = iter.next();
		let tick = delay();

		for (;;) {
			const winner = await Promise.race([
				next.then((r) => ({ type: "chunk" as const, result: r })),
				tick.then(() => ({ type: "tick" as const, result: null })),
			]);

			if (winner.type === "tick") {
				await flush();
				tick = delay();
				continue;
			}

			if (winner.result.done) break;
			s.buffer += winner.result.value.text;

			// 2000자 초과 → 현재 메시지 확정, 나머지를 새 메시지로
			if (s.msg && s.buffer.length > 2000) {
				await s.msg.edit(s.buffer.slice(0, 2000)).catch(() => {});
				s.buffer = s.buffer.slice(2000);
				s.msg = null;
			}

			next = iter.next();
		}

		await flush();
	}
}
