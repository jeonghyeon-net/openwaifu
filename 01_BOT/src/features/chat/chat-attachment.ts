import type { ImageContent } from "@mariozechner/pi-ai";

export type ChatAttachment = {
  name: string;
  url: string;
  contentType?: string;
  size: number;
};

export type PreparedChatAttachment = ChatAttachment & {
  path: string;
  image?: ImageContent;
  textPreview?: string;
  note?: string;
  error?: string;
};

export const attachmentOnlyPrompt = "User sent attachment files. Analyze them.";
