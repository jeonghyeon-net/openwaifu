import { defineTool } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";

import type { DiscordAdminService } from "./discord-admin-types.js";
import { discordToolResult } from "./discord-tool-result.js";

export const createInspectServerTool = (service: DiscordAdminService) =>
  defineTool({
    name: "discord_inspect_server",
    label: "Discord Inspect Server",
    description: "Inspect Discord server summary, channels, roles, or members.",
    promptSnippet: "`discord_inspect_server`: inspect server summary, channels, roles, or members",
    parameters: Type.Object({
      guildId: Type.Optional(Type.String({ description: "Optional guild id. Defaults to current guild." })),
      limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100, description: "Member limit for members view" })),
      view: Type.Union([
        Type.Literal("summary"),
        Type.Literal("channels"),
        Type.Literal("roles"),
        Type.Literal("members"),
      ]),
    }),
    execute: async (_id, input) => discordToolResult(await service.inspectServer(input)),
  });
