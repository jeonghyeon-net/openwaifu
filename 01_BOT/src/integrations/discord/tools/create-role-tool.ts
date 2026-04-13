import { defineTool } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";

import type { DiscordAdminService } from "./discord-admin-types.js";
import { discordToolResult } from "./discord-tool-result.js";

export const createCreateRoleTool = (service: DiscordAdminService) =>
  defineTool({
    name: "discord_create_role",
    label: "Discord Create Role",
    description: "Create Discord role in current or specified guild.",
    promptSnippet: "`discord_create_role`: create Discord role in current or specified guild",
    parameters: Type.Object({
      guildId: Type.Optional(Type.String({ description: "Optional guild id. Defaults to current guild." })),
      name: Type.String({ description: "Role name" }),
      colorHex: Type.Optional(Type.String({ description: "Optional role color like #ff00aa" })),
      hoist: Type.Optional(Type.Boolean({ description: "Show role separately" })),
      mentionable: Type.Optional(Type.Boolean({ description: "Allow role mentions" })),
    }),
    execute: async (_id, input) => discordToolResult(await service.createRole(input)),
  });
