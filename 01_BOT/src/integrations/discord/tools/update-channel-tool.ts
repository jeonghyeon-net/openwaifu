import { defineTool } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";

import type { DiscordAdminService } from "./discord-admin-types.js";
import { discordToolResult } from "./discord-tool-result.js";

export const createUpdateChannelTool = (service: DiscordAdminService) =>
  defineTool({
    name: "discord_update_channel",
    label: "Discord Update Channel",
    description: "Rename channel, move category, or change topic on supported channel types.",
    promptSnippet: "`discord_update_channel`: rename or reconfigure Discord channel",
    parameters: Type.Object({
      channelId: Type.String({ description: "Channel id to update" }),
      name: Type.Optional(Type.String({ description: "New channel name" })),
      categoryId: Type.Optional(Type.String({ description: "New category id. Empty string clears parent." })),
      topic: Type.Optional(Type.String({ description: "New topic. Empty string clears topic." })),
      reason: Type.Optional(Type.String({ description: "Optional audit log reason" })),
    }),
    execute: async (_id, input) => discordToolResult(await service.updateChannel(input)),
  });
