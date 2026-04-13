import { mkdir, writeFile } from "node:fs/promises";
import { Buffer } from "node:buffer";

import { DEFAULT_MAX_BYTES, DEFAULT_MAX_LINES, truncateHead } from "@mariozechner/pi-coding-agent";
import type { ImageContent } from "@mariozechner/pi-ai";

import { isImageAttachment, isTextAttachment } from "./attachment-classify.js";
import { attachmentDirectoryForMessage, attachmentPathForName } from "./attachment-path.js";
import type { ChatAttachment, PreparedChatAttachment } from "./chat-attachment.js";

const maxImageBytes = 5 * 1024 * 1024;
const textPreview = (bytes: Buffer) =>
  truncateHead(bytes.toString("utf8"), { maxBytes: DEFAULT_MAX_BYTES, maxLines: DEFAULT_MAX_LINES }).content;
const imageContent = (attachment: ChatAttachment, bytes: Buffer): ImageContent | undefined => {
  if (!isImageAttachment(attachment) || !attachment.contentType?.startsWith("image/")) return undefined;
  if (bytes.byteLength > maxImageBytes) return undefined;
  return { type: "image", data: bytes.toString("base64"), mimeType: attachment.contentType };
};
const noteFor = (attachment: ChatAttachment, bytes: Buffer) => {
  if (isImageAttachment(attachment) && bytes.byteLength > maxImageBytes) return "image too large for direct vision input";
  if (!isTextAttachment(attachment) && !isImageAttachment(attachment)) return "binary attachment saved locally; use saved path if needed";
  return undefined;
};

export const loadChatAttachments = async (
  repoRoot: string,
  scopeId: string,
  messageId: string,
  attachments: ChatAttachment[],
) => {
  if (attachments.length === 0) return [];
  const dir = attachmentDirectoryForMessage(repoRoot, scopeId, messageId);
  await mkdir(dir, { recursive: true });

  return Promise.all(attachments.map(async (attachment, index): Promise<PreparedChatAttachment> => {
    const path = attachmentPathForName(dir, index, attachment.name);
    try {
      const response = await fetch(attachment.url);
      if (!response.ok) throw new Error(`download failed: ${response.status}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      await writeFile(path, bytes);
      return {
        ...attachment,
        path,
        image: imageContent(attachment, bytes),
        textPreview: isTextAttachment(attachment) ? textPreview(bytes) : undefined,
        note: noteFor(attachment, bytes),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { ...attachment, path, error: message };
    }
  }));
};
