import type { ImageContent } from "@mariozechner/pi-ai";

import { loadChatAttachments } from "./attachment-loader.js";
import { promptWithAttachments } from "./attachment-prompt.js";
import type { ChatAttachment } from "./chat-attachment.js";

export type ChatPromptInput = {
  repoRoot: string;
  scopeId: string;
  messageId: string;
  prompt: string;
  attachments: ChatAttachment[];
};

export const prepareChatPrompt = async ({
  repoRoot,
  scopeId,
  messageId,
  prompt,
  attachments,
}: ChatPromptInput): Promise<{ prompt: string; images?: ImageContent[] }> => {
  const prepared = await loadChatAttachments(repoRoot, scopeId, messageId, attachments);
  const images = prepared.flatMap((attachment) => (attachment.image ? [attachment.image] : []));
  return {
    prompt: promptWithAttachments(prompt, prepared),
    images: images.length ? images : undefined,
  };
};
