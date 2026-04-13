import { defineTool } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";

import type { DiscordAdminService } from "./discord-admin-types.js";
import { discordToolResult } from "./discord-tool-result.js";

export const createSendMessageTool = (service: DiscordAdminService) =>
  defineTool({
    name: "discord_send_message",
    label: "Discord Send Message",
    description: "Send message to Discord channel. Defaults to current channel if channelId omitted.",
    promptSnippet: "`discord_send_message`: send message to current or specified Discord channel",
    parameters: Type.Object({
      channelId: Type.Optional(Type.String({ description: "Optional channel id. Defaults to current channel." })),
      content: Type.String({ description: "Message content to send" }),
    }),
    execute: async (_id, input) => discordToolResult(await service.sendMessage(input)),
  });
