import { Events } from "discord.js";

import { buildChatRequest } from "../../features/chat/chat-message.js";
import type { ChatService } from "../../features/chat/chat-service.js";
import { limitText } from "../pi/format-text.js";
import { setBusyPresence, startTypingLoop } from "./handler-presence.js";
import { toChatMessage, type DiscordEventClient, type IncomingDiscordMessage } from "./handler-message.js";
import { streamDiscordReply } from "./handler-stream.js";

type HandlerDeps = { client: DiscordEventClient; chatService: ChatService };

export const registerDiscordHandlers = ({ client, chatService }: HandlerDeps) => {
  let activeResponses = 0;
  client.on(Events.MessageCreate, async (message: IncomingDiscordMessage) => {
    const request = buildChatRequest(toChatMessage(message));
    if (!request) return;
    const stopTyping = startTypingLoop(message);
    activeResponses += 1;
    setBusyPresence(client, activeResponses);
    try {
      await streamDiscordReply(message, chatService.stream(request));
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      await message.reply(limitText(`에러: ${text}`));
    } finally {
      stopTyping();
      activeResponses = Math.max(0, activeResponses - 1);
      setBusyPresence(client, activeResponses);
    }
  });
};
