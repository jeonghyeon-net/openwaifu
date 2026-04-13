export type ChatRequest = {
  prompt: string;
  scopeId: string;
};

export type ChatMessage = {
  authorId: string;
  channelId: string;
  content: string;
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
  if (message.isBot) {
    return null;
  }

  const prompt = normalizePrompt(message.content);
  if (!prompt) {
    return null;
  }

  return {
    prompt,
    scopeId: scopeIdOf(message),
  };
};
