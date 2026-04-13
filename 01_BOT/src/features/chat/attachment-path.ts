import { join } from "node:path";

const sanitize = (value: string) => value.replace(/[^a-zA-Z0-9._-]/g, "_");

export const attachmentDirectoryForMessage = (
  repoRoot: string,
  scopeId: string,
  messageId: string,
) => join(repoRoot, "01_BOT", ".data", "discord-attachments", sanitize(scopeId), sanitize(messageId));

export const attachmentPathForName = (dir: string, index: number, name: string) =>
  join(dir, `${String(index).padStart(2, "0")}_${sanitize(name) || "attachment"}`);
