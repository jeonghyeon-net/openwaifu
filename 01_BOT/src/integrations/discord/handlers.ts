import { Events, type Client, type Message } from "discord.js";

import { buildChatRequest } from "../../features/chat/chat-message.js";
import type { ChatService } from "../../features/chat/chat-service.js";
import { limitText } from "../pi/format-text.js";

type DiscordEventClient = Pick<Client, "on">;
type IncomingDiscordMessage = Pick<
  Message<boolean>,
  "author" | "channel" | "channelId" | "content" | "guildId" | "reply"
>;

type HandlerDeps = {
  client: DiscordEventClient;
  chatService: ChatService;
};

const toChatMessage = (message: IncomingDiscordMessage) => ({
  authorId: message.author.id,
  channelId: message.channelId,
  content: message.content,
  guildId: message.guildId ?? undefined,
  isBot: message.author.bot,
  isDirectMessage: message.channel.isDMBased(),
});

export const registerDiscordHandlers = ({ client, chatService }: HandlerDeps) => {
  client.on(Events.MessageCreate, async (message: IncomingDiscordMessage) => {
    const request = buildChatRequest(toChatMessage(message));
    if (!request) return;

    try {
      await message.reply(limitText(await chatService.reply(request)));
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      await message.reply(limitText(`에러: ${text}`));
    }
  });
};
