import type { PiRuntime, RuntimeTextChunk } from "../../integrations/pi/pi-runtime.js";
import type { ChatRequest } from "./chat-message.js";

type ChatRuntime = Pick<PiRuntime, "prompt" | "stream">;

const discordContextOf = (request: ChatRequest) => ({
  authorId: request.authorId,
  channelId: request.channelId,
  channelName: request.channelName,
  guildId: request.guildId,
  guildName: request.guildName,
  isDirectMessage: request.isDirectMessage,
});

const promptOptionsOf = (request: ChatRequest) => ({
  messageId: request.messageId,
  attachments: request.attachments,
});

export type ChatService = {
  reply(request: ChatRequest): Promise<string>;
  stream(request: ChatRequest): AsyncIterable<RuntimeTextChunk>;
};

export const createChatService = (runtime: ChatRuntime): ChatService => ({
  reply: (request) =>
    runtime.prompt(
      request.scopeId,
      request.prompt,
      discordContextOf(request),
      promptOptionsOf(request),
    ),
  stream: (request) =>
    runtime.stream(
      request.scopeId,
      request.prompt,
      discordContextOf(request),
      promptOptionsOf(request),
    ),
});
