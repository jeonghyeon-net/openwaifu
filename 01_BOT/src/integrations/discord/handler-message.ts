import type { Message } from "discord.js";

export type DiscordEventClient = {
  on(event: string, handler: (message: IncomingDiscordMessage) => Promise<void>): unknown;
  user?: { setPresence(args: { status: "dnd" | "online" }): unknown } | null;
};
export type IncomingDiscordAttachment = {
  name: string | null;
  url: string;
  contentType: string | null;
  size: number;
};
export type SentDiscordMessage = { edit(content: string): Promise<unknown> };
export type DiscordMessageChannel = {
  isDMBased(): boolean;
  sendTyping(): Promise<unknown>;
};
export type IncomingDiscordMessage = Pick<
  Message<boolean>,
  "author" | "channelId" | "content" | "guildId" | "id"
> & {
  channel: DiscordMessageChannel;
  reply(content: string): Promise<SentDiscordMessage | undefined>;
  attachments: { values(): IterableIterator<IncomingDiscordAttachment> };
};

export const toChatMessage = (message: IncomingDiscordMessage) => ({
  messageId: message.id,
  authorId: message.author.id,
  channelId: message.channelId,
  content: message.content,
  guildId: message.guildId ?? undefined,
  isBot: message.author.bot,
  isDirectMessage: message.channel.isDMBased(),
  attachments: Array.from(message.attachments.values()).map((attachment) => ({
    name: attachment.name || "attachment",
    url: attachment.url,
    contentType: attachment.contentType || undefined,
    size: attachment.size,
  })),
});
