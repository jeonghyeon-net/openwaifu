import { defineTool } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";

import type { DiscordAdminService } from "./discord-admin-types.js";
import { discordToolResult } from "./discord-tool-result.js";

export const createDeleteChannelTool = (service: DiscordAdminService) =>
  defineTool({
    name: "discord_delete_channel",
    label: "Discord Delete Channel",
    description: "Delete Discord channel by id.",
    promptSnippet: "`discord_delete_channel`: delete Discord channel by id",
    promptGuidelines: ["Delete Discord channels only when user explicitly asks."],
    parameters: Type.Object({
      channelId: Type.String({ description: "Channel id to delete" }),
      reason: Type.Optional(Type.String({ description: "Optional audit log reason" })),
    }),
    execute: async (_id, input) => discordToolResult(await service.deleteChannel(input)),
  });
