import type { PiRuntime } from "../../integrations/pi/pi-runtime.js";
import type { ChatRequest } from "./chat-message.js";

type ChatRuntime = Pick<PiRuntime, "prompt">;

export type ChatService = {
  reply(request: ChatRequest): Promise<string>;
};

export const createChatService = (runtime: ChatRuntime): ChatService => ({
  reply: (request) =>
    runtime.prompt(
      request.scopeId,
      request.prompt,
      {
        authorId: request.authorId,
        channelId: request.channelId,
        guildId: request.guildId,
        isDirectMessage: request.isDirectMessage,
      },
      { messageId: request.messageId, attachments: request.attachments },
    ),
});
