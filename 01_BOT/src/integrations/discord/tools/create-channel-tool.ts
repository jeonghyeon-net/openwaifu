import { defineTool } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";

import type { DiscordAdminService } from "./discord-admin-types.js";
import { discordToolResult } from "./discord-tool-result.js";

export const createCreateChannelTool = (service: DiscordAdminService) =>
  defineTool({
    name: "discord_create_channel",
    label: "Discord Create Channel",
    description: "Create text, voice, forum, or announcement channel in Discord guild.",
    promptSnippet: "`discord_create_channel`: create Discord channel in current or specified guild",
    parameters: Type.Object({
      guildId: Type.Optional(Type.String({ description: "Optional guild id. Defaults to current guild." })),
      name: Type.String({ description: "Channel name" }),
      type: Type.Union([
        Type.Literal("text"),
        Type.Literal("voice"),
        Type.Literal("forum"),
        Type.Literal("announcement"),
      ]),
      categoryId: Type.Optional(Type.String({ description: "Optional parent category id" })),
      topic: Type.Optional(Type.String({ description: "Optional topic for supported channel types" })),
    }),
    execute: async (_id, input) => discordToolResult(await service.createChannel(input)),
  });
