import { Events, type Client, type Message } from "discord.js";

import { buildChatRequest } from "../../features/chat/chat-message.js";
import type { ChatService } from "../../features/chat/chat-service.js";
import { limitText } from "../pi/format-text.js";

type HandlerDeps = {
  client: Client;
  chatService: ChatService;
};

const toChatMessage = (message: Message<boolean>) => ({
  authorId: message.author.id,
  channelId: message.channelId,
  content: message.content,
  isBot: message.author.bot,
  isDirectMessage: message.channel.isDMBased(),
});

export const registerDiscordHandlers = ({ client, chatService }: HandlerDeps) => {
  client.on(Events.MessageCreate, async (message) => {
    const request = buildChatRequest(toChatMessage(message));
    if (!request) return;

    try {
      await message.reply(limitText(await chatService.reply(request.scopeId, request.prompt)));
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      await message.reply(limitText(`에러: ${text}`));
    }
  });
};
