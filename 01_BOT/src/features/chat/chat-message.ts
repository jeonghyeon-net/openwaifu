import { attachmentOnlyPrompt, type ChatAttachment } from "./chat-attachment.js";

export type ChatRequest = {
  prompt: string;
  scopeId: string;
  messageId: string;
  authorId: string;
  channelId: string;
  channelName?: string;
  guildId?: string;
  guildName?: string;
  isDirectMessage: boolean;
  attachments: ChatAttachment[];
};

export type ChatMessage = {
  messageId: string;
  authorId: string;
  channelId: string;
  channelName?: string;
  content: string;
  guildId?: string;
  guildName?: string;
  isBot: boolean;
  isDirectMessage: boolean;
  attachments: ChatAttachment[];
};

const normalizePrompt = (content: string, attachments: ChatAttachment[]) => {
  const prompt = content.trim();
  if (prompt !== "") return prompt;
  return attachments.length > 0 ? attachmentOnlyPrompt : null;
};

const scopeIdOf = ({ authorId, channelId, isDirectMessage }: ChatMessage) =>
  isDirectMessage ? `dm:${authorId}` : `channel:${channelId}:user:${authorId}`;

export const buildChatRequest = (message: ChatMessage): ChatRequest | null => {
  const prompt = normalizePrompt(message.content, message.attachments);
  if (message.isBot || !prompt) return null;

  return {
    prompt,
    scopeId: scopeIdOf(message),
    messageId: message.messageId,
    authorId: message.authorId,
    channelId: message.channelId,
    channelName: message.channelName,
    guildId: message.guildId,
    guildName: message.guildName,
    isDirectMessage: message.isDirectMessage,
    attachments: message.attachments,
  };
};
