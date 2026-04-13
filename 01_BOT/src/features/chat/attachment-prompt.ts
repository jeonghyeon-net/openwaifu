import type { PreparedChatAttachment } from "./chat-attachment.js";

const block = (title: string, body: string) => `${title}\n\`\`\`\n${body}\n\`\`\``;

export const attachmentPromptSection = (attachments: PreparedChatAttachment[]) => {
  if (attachments.length === 0) return "";
  const lines = ["[Discord attachments]"];

  for (const attachment of attachments) {
    lines.push(`- ${attachment.name} (${attachment.contentType || "unknown"}, ${attachment.size} bytes)`);
    lines.push(`  saved_path: ${attachment.path}`);
    if (attachment.image) lines.push("  image attached to model input");
    if (attachment.note) lines.push(`  note: ${attachment.note}`);
    if (attachment.error) lines.push(`  error: ${attachment.error}`);
    if (attachment.textPreview) lines.push(block("  text_preview:", attachment.textPreview));
  }

  return lines.join("\n");
};

export const promptWithAttachments = (prompt: string, attachments: PreparedChatAttachment[]) => {
  const section = attachmentPromptSection(attachments);
  return section ? `${prompt}\n\n${section}` : prompt;
};
