import type { ChatPlatform, IncomingMessage } from "@lib/chat-platform";
import type {
	ChatAttachment,
	ChatBot,
	ChatBotConfig,
	ChatBotFactory,
} from "@lib/llm";
import type { SessionStore } from "@lib/session-store";

export class ChannelWorker {
	private bot: ChatBot | null = null;
	private botReady: Promise<void>;
	private pending: IncomingMessage | null = null;
	private draining = false;

	constructor(
		private channelId: string,
		private platform: ChatPlatform,
		private sessions: SessionStore,
		factory: ChatBotFactory,
		config: ChatBotConfig,
		resumeSessionId?: string,
	) {
		this.botReady = factory(config, resumeSessionId).then((b) => {
			this.bot = b;
		});
	}

	enqueue(msg: IncomingMessage): void {
		this.pending = msg;
		if (this.bot) this.bot.interrupt();
		if (!this.draining) this.drain();
	}

	private async drain(): Promise<void> {
		this.draining = true;
		await this.botReady;
		while (this.pending) {
			const msg = this.pending;
			this.pending = null;
			await this.process(msg);
		}
		this.draining = false;
	}

	private async process(msg: IncomingMessage): Promise<void> {
		if (!this.bot) return;

		const history = await this.platform.fetchHistory(this.channelId, 30);

		// fetchHistory 중 새 메시지가 왔으면 이 메시지는 버림
		if (this.pending) return;

		const historyText = history
			.map(
				(h) => `${h.username}(${h.userId})${h.isSelf ? "[너]" : ""}: ${h.text}`,
			)
			.join("\n");
		const meta = Object.entries(msg.metadata)
			.filter(([, v]) => v)
			.map(([k, v]) => `${k}: ${v}`)
			.join(", ");
		const context = `[channelId: ${this.channelId}, userId: ${msg.userId}, username: ${msg.username}${meta ? `, ${meta}` : ""}]`;
		const fullMessage = historyText
			? `<recent_chat_history>\n${historyText}\n</recent_chat_history>\n${context}\n${msg.text}`
			: `${context}\n${msg.text}`;

		const attachments: ChatAttachment[] | undefined =
			msg.attachments.length > 0
				? msg.attachments.map((a) => ({
						url: a.url,
						filename: a.filename,
						contentType: a.contentType,
						size: a.size,
					}))
				: undefined;

		const chat = this.bot.chat(fullMessage, attachments);

		await this.platform.sendStream(this.channelId, chat.stream);

		if (this.bot.sessionId) {
			this.sessions.set(this.channelId, this.bot.sessionId);
		}
	}
}
