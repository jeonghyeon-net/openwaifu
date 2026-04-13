export type ChatScopeTarget = {
  authorId: string;
  channelId: string;
  isDirectMessage: boolean;
};

export const scopeIdOfChatTarget = ({ authorId, channelId, isDirectMessage }: ChatScopeTarget) =>
  isDirectMessage ? `dm:${authorId}` : `channel:${channelId}:user:${authorId}`;
