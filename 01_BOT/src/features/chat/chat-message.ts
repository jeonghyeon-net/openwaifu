export type ChatRequest = {
  prompt: string;
  scopeId: string;
  authorId: string;
  channelId: string;
  guildId?: string;
  isDirectMessage: boolean;
};

export type ChatMessage = {
  authorId: string;
  channelId: string;
  content: string;
  guildId?: string;
  isBot: boolean;
  isDirectMessage: boolean;
};

const normalizePrompt = (content: string) => {
  const prompt = content.trim();
  return prompt === "" ? null : prompt;
};

const scopeIdOf = ({ authorId, channelId, isDirectMessage }: ChatMessage) =>
  isDirectMessage ? `dm:${authorId}` : `channel:${channelId}:user:${authorId}`;

export const buildChatRequest = (message: ChatMessage): ChatRequest | null => {
  const prompt = normalizePrompt(message.content);
  if (message.isBot || !prompt) return null;

  return {
    prompt,
    scopeId: scopeIdOf(message),
    authorId: message.authorId,
    channelId: message.channelId,
    guildId: message.guildId,
    isDirectMessage: message.isDirectMessage,
  };
};
