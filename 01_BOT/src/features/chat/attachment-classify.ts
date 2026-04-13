import type { ChatAttachment } from "./chat-attachment.js";

const textExtensions = new Set([
  ".txt", ".md", ".json", ".jsonl", ".csv", ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
  ".yml", ".yaml", ".xml", ".html", ".css", ".py", ".rb", ".java", ".go", ".rs", ".sh", ".log",
]);
const imageExtensions = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp"]);
const extensionOf = (name: string) => name.slice(name.lastIndexOf(".")).toLowerCase();

export const isImageAttachment = (attachment: ChatAttachment) =>
  attachment.contentType?.startsWith("image/") || imageExtensions.has(extensionOf(attachment.name));

export const isTextAttachment = (attachment: ChatAttachment) =>
  attachment.contentType?.startsWith("text/") ||
  attachment.contentType === "application/json" ||
  textExtensions.has(extensionOf(attachment.name));
