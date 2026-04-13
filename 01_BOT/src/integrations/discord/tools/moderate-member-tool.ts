import { defineTool } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";

import type { DiscordAdminService } from "./discord-admin-types.js";
import { discordToolResult } from "./discord-tool-result.js";

export const createModerateMemberTool = (service: DiscordAdminService) =>
  defineTool({
    name: "discord_moderate_member",
    label: "Discord Moderate Member",
    description: "Timeout, clear timeout, rename, kick, ban, or unban Discord member.",
    promptSnippet: "`discord_moderate_member`: timeout, rename, kick, ban, or unban member",
    promptGuidelines: ["Kick, ban, and timeout only when user clearly asks for moderation."],
    parameters: Type.Object({
      guildId: Type.Optional(Type.String({ description: "Optional guild id. Defaults to current guild." })),
      memberId: Type.String({ description: "Member id to moderate" }),
      action: Type.Union([
        Type.Literal("timeout"),
        Type.Literal("remove_timeout"),
        Type.Literal("nickname"),
        Type.Literal("kick"),
        Type.Literal("ban"),
        Type.Literal("unban"),
      ]),
      durationMinutes: Type.Optional(Type.Number({ minimum: 1, maximum: 40320 })),
      nickname: Type.Optional(Type.String({ description: "Nickname for nickname action. Empty string clears nickname." })),
      deleteMessageSeconds: Type.Optional(Type.Number({ minimum: 0, maximum: 604800 })),
      reason: Type.Optional(Type.String({ description: "Optional audit log reason" })),
    }),
    execute: async (_id, input) => discordToolResult(await service.moderateMember(input)),
  });
