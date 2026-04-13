import type { PiThinkingLevel } from "../../config/pi-config.js";
import type { ChatAttachment } from "../../features/chat/chat-attachment.js";
import type { DiscordAdminClient } from "../discord/tools/discord-admin-types.js";

export type ChatPromptOptions = { messageId: string; attachments: ChatAttachment[] };
export type PiRuntimeOptions = {
  repoRoot: string;
  sessionsRoot: string;
  extensionsRoot: string;
  skillsRoot: string;
  modelId: string;
  thinkingLevel?: PiThinkingLevel;
  discordClient: DiscordAdminClient;
};

export const emptyChatPromptOptions: ChatPromptOptions = { messageId: "", attachments: [] };
